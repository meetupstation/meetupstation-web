import * as pageElements from './pageElements.js';
import * as webrtcElements from './webrtcElements.js';
import * as signalling from './signalling.js';

export async function meet(
    roomId:number,
    rooms: Map<string, webrtcElements.Room>
): Promise<void> {

    let meetingType: webrtcElements.MeetingType|null = null;

    do {

        const room = (
            (rooms: Map<string, webrtcElements.Room>)
                : webrtcElements.Room => {
                const room = rooms.get(`${roomId}`);
                if (!room) {
                    throw new Error('undefined room object');
                }
                return room;
            }
        )(rooms);

        const peerConnectionId = `${room.nextPeerConnectionId}`;
        try {
            room.nextPeerConnectionId++;

            pageElements.roomSetProgress(
                room.id,
                'creating the peer connection'
            );

            const peerConnection =
                await initializePeerConnection(
                    room.id,
                    peerConnectionId
                );

            room.peerConnections.set(peerConnectionId, peerConnection);

            pageElements.roomSetProgress(
                room.id,
                'creating the guest answer or the host offer'
            );

            meetingType =
                await prepareGuestAnswerOrHostOffer(
                    peerConnection,
                    room,
                    meetingType,
                    pageElements.getRoomIdentifier(room.id)
                );

            pageElements.roomSetProgress(
                room.id,
                'collecting all ice candidates'
            );

            const localSessionDescription = await waitForLocalDescription(room);

            pageElements.roomSetProgress(
                room.id,
                'signalling on the room id'
            );

            if (meetingType === webrtcElements.MeetingType.HOST) {

                const hostSignal =
                    await fetch(
                        `api/host?id=${pageElements.getRoomIdentifier(room.id)}`,
                        {
                            method: 'GET'
                        }
                    );

                if (hostSignal.ok) {
                    throw new webrtcElements.ControlledError('host already exists, while trying to create a new one');
                }

                pageElements.roomSetProgress(
                    room.id,
                    'going to wait for the guest to join...'
                );

                while (true) {
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    pageElements.roomSetProgress(
                        room.id,
                        'waiting for the guest to join...'
                    );
                    const guestSignal =
                        await fetch(
                            `api/guest?hostId=${pageElements.getRoomIdentifier(room.id)}`,
                            {
                                method: 'GET'
                            }
                        );

                    if (!guestSignal.ok) {
                        pageElements.roomSetProgress(
                            room.id,
                            '(re?)creating the host'
                        );

                        const signallingHost = await signalling.hostPost(
                            pageElements.getRoomIdentifier(room.id),
                            localSessionDescription,
                            ''
                        );
                        pageElements.setRoomIdentifier(room.id, signallingHost.id);
                    } else {
                        const guestSignalJson = await guestSignal.json();
                        if (guestSignalJson.guestDescription) {
                            await peerConnection.setRemoteDescription(
                                JSON.parse(atob(guestSignalJson.guestDescription))
                            );

                            break;
                        }
                    }
                }
            } else {

                const guestSignal =
                    await fetch(
                        'api/guest',
                        {
                            method: 'POST',
                            body: `{"hostId": "${pageElements.getRoomIdentifier(room.id)}", "guestDescription": "${localSessionDescription}"}`,
                            headers: {
                                'Content-type': 'application/json; charset=UTF-8'
                            }
                        }
                    );

                if (!guestSignal.ok) {
                    throw new webrtcElements.ControlledError('while trying to find the host');
                }

                //const _guestSignalJson =
                await guestSignal.json();
            }

            pageElements.roomSetProgress(
                room.id,
                'connecting...'
            );
            await waitForIceConnected(room, peerConnection);

            pageElements.roomSetProgress(room.id, '');

            const localIpAddress = getIpAddressUtility(peerConnection.localDescription);
            const remoteIpAddress = getIpAddressUtility(peerConnection.remoteDescription);

            pageElements.roomSetPeerConnectionStatus(
                room.id,
                peerConnectionId,
                `${localIpAddress}<=>${remoteIpAddress}`
            );

            setUpDataChannelUtility();

            const handleDisconnect = async () => {
                await waitForIceDisonnected(room, peerConnection);
                pageElements.roomSetPeerConnectionStatus(
                    room.id,
                    peerConnectionId,
                    'disconnected'
                );
                pageElements.roomRemoveRemoteVideo(room.id, peerConnectionId);

                if (peerConnection) {
                    peerConnection.close();
                    room.peerConnections.delete(peerConnectionId);
                }
            };
            const promiseDisconnected = handleDisconnect();

            if (meetingType === webrtcElements.MeetingType.GUEST) {
                await promiseDisconnected;
            }
        } catch (error) {
            if (error instanceof pageElements.RoomClosed) {
                break;
            } else {
                console.error(`caught: ${error}`);

                pageElements.roomRemoveRemoteVideo(room.id, peerConnectionId);
                const peerConnection =
                    room.peerConnections.get(peerConnectionId);
                if (peerConnection) {
                    peerConnection.close();
                    room.peerConnections.delete(peerConnectionId);
                }

                if (error instanceof webrtcElements.ControlledError &&
                    pageElements.roomRepeatChecked(room.id)
                ) {
                    continue;
                }

                throw error;
            }
        }
    } while (pageElements.roomRepeatChecked(roomId));
}

async function initializePeerConnection(
    roomId: number,
    peerId: string
): Promise<RTCPeerConnection> {
    const peerConnection = new RTCPeerConnection({
        iceServers: [{
            urls: 'stun:stun.l.google.com:19302'
        }]
    });
    // stun:stun.l.google.com:19302
    // stun:stun.stunprotocol.org

    peerConnection.ontrack = function (event) {
        pageElements.roomSetRemoteVideoStream(
            roomId,
            peerId,
            event.streams[0]
        );
    };

    return peerConnection;
}

async function prepareGuestAnswerOrHostOffer(
    peerConnection: RTCPeerConnection,
    room: webrtcElements.Room,
    meetingTypeInsist: webrtcElements.MeetingType|null,
    roomIdentifier: string
): Promise<webrtcElements.MeetingType> {

    const media = await pageElements.getUserMedia(room.id);
    if (media.stream) {
        for (const track of media.stream.getTracks()) {
            peerConnection.addTrack(track, media.stream);
        }

        pageElements.roomSetLocalVideoStream(
            room.id,
            media.stream
        );
    }

    const signallingHost = await signalling.hostPost(roomIdentifier,'','');

    peerConnection.onicecandidate = async (event) => {
        // this is what makes waitForLocalDescription functional
        //
        if (event.candidate === null) {
            // console.log('all ice candidates', event);
            const ld = JSON.stringify(peerConnection.localDescription);
            room.localSessionDescription = btoa(ld);
        } else {
            await signalling.hostPost(
                roomIdentifier,
                btoa(JSON.stringify(event.candidate)),
                signallingHost.accessKey
            );
        }
    };

    const meetingType = await (
        async (meetingTypeInsist: webrtcElements.MeetingType|null)
            : Promise<webrtcElements.MeetingType> => {
            if (meetingTypeInsist === null) {
                const hostId = pageElements.getRoomIdentifier(room.id);
                if (!hostId) {
                    return webrtcElements.MeetingType.HOST;
                } else {
                    const hostSignal =
                    await fetch(
                        `api/host?id=${hostId}`,
                        {
                            method: 'GET'
                        }
                    );

                    return hostSignal.ok ?
                        webrtcElements.MeetingType.GUEST :
                        webrtcElements.MeetingType.HOST;
                }
            } else {
                return meetingTypeInsist;
            }
        })(meetingTypeInsist);

    if (meetingType === webrtcElements.MeetingType.GUEST) {
        const hostId = pageElements.getRoomIdentifier(room.id);
        if (!hostId) {
            throw new Error(`roomId: ${room.id}, empty hostId`);
        }

        const hostSignal = await fetch(`api/host?id=${hostId}`, {
            method: 'GET'
        });

        if (!hostSignal.ok) {
            throw new webrtcElements.ControlledError(`roomId: ${room.id}, host not set up`);
        }

        const hostSignalJson = await hostSignal.json();

        const rd = JSON.parse(atob(hostSignalJson.description));

        prepareDataChannel(room, peerConnection);

        await peerConnection.setRemoteDescription(rd);

        const answerDescription = await peerConnection.createAnswer();
        peerConnection.setLocalDescription(answerDescription);
    } else/* if (meetingType === MeetingType.HOST)*/ {
        if (!media.audio) {
            peerConnection.addTransceiver('audio', { 'direction': 'recvonly' });
        }
        if (!media.video) {
            peerConnection.addTransceiver('video', { 'direction': 'recvonly' });
        }

        prepareDataChannel(room, peerConnection);

        const offer = await peerConnection.createOffer();

        await peerConnection.setLocalDescription(offer);
    }

    return meetingType;
}

async function waitForLocalDescription(
    room: webrtcElements.Room
): Promise<string> {
    while (!room.localSessionDescription) {
        await new Promise(resolve => setTimeout(resolve, 25));
        pageElements.assertRoomActive(room.id);
    }

    const localSessionDescription = room.localSessionDescription!;
    room.localSessionDescription = null;
    return localSessionDescription;
}

async function waitForIceConnected(
    room: webrtcElements.Room,
    peerConnection: RTCPeerConnection
): Promise<void> {
    const stepWait = 25;
    const timeOut = 60 * 1000 / stepWait;

    let steps = 0;
    while (
        [
            'new',
            'checking',
            'disconnected'
        ].indexOf(peerConnection.iceConnectionState) !== -1
    ) {
        await new Promise(resolve => setTimeout(resolve, stepWait));

        ++steps;
        pageElements.assertRoomActive(room.id);

        if (steps == timeOut) {
            throw new webrtcElements.ControlledError(`roomId: ${room.id} gave up while waiting for ice connection`);
        }
    }

    if (peerConnection.iceConnectionState !== 'connected') {
        throw new webrtcElements.ControlledError(`unexpected iceConnectionState (connected?) while waiting for ice connection: ${peerConnection.iceConnectionState}`);
    }
}

async function waitForIceDisonnected(
    room: webrtcElements.Room,
    peerConnection: RTCPeerConnection
): Promise<void> {

    let dataChannel = room.dataChannel;
    while (peerConnection.iceConnectionState === 'connected') {
        if (!room) {
            return;
        }

        if (!!dataChannel === true && room.dataChannel === null) {
            pageElements.resetDataControllers();
        }
        dataChannel = room.dataChannel;

        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (peerConnection.iceConnectionState !== 'disconnected') {
        throw new webrtcElements.ControlledError(`unexpected iceConnectionState (disconnected?) while waiting for ice connection: ${peerConnection.iceConnectionState}`);
    }
}

function prepareDataChannel(
    room: webrtcElements.Room,
    peerConnection: RTCPeerConnection
): void {
    const dataChannel = peerConnection.createDataChannel('meetupstation', {
        ordered: true,
        negotiated: true,
        id: 0
    });

    dataChannel.onopen = () => {
        room.dataChannel = dataChannel;
        dataChannel.onmessage = (message) => {
            dataChannelHandler(message.data);
            console.log(message.data);
        };
    };
    dataChannel.onclose = () => {
        room.dataChannel = null;
    };
}

function getIpAddressUtility(description: RTCSessionDescription|null): string {
    if (description === null)
        return '';
    return description.sdp.split('\r\n')
        .filter(
            function (line) {
                return line.indexOf('c=IN IP4 ') === 0;
            }
        )
        .filter(function (line, index, array) {
            return array.indexOf(line) === index;
        })
        .map(function (line) {
            return line.substring(9);
        })
        .filter(function (line) {
            return line !== '0.0.0.0';
        })
        .join(',');
}

function setUpDataChannelUtility(): void { }

function dataChannelHandler(_messageData: string): void { }
