import * as pageElements from './pageElements.js';
import * as webrtcElements from './webrtcElements.js';
import * as signalling from './signalling.js';

export async function meet(
    roomId: number,
    rooms: Map<string, webrtcElements.Room>
): Promise<void> {

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

        room.localSessionDescription = '';
        room.localCandidates = [];
        room.remoteSessionDescription = '';
        room.remoteCandidates = [];

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

            room.signalId = pageElements.getRoomIdentifier(room.id);

            room.meetingType =
                await prepareGuestAnswerOrHostOffer(
                    peerConnection,
                    room
                );

            pageElements.setRoomIdentifier(room.id, room.signalId);

            if (room.meetingType === webrtcElements.MeetingType.HOST) {

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
                            `api/guest?hostId=${room.signalId}`,
                            {
                                method: 'GET'
                            }
                        );

                    if (!guestSignal.ok) {
                        throw new webrtcElements.ControlledError('see what happens');
                        pageElements.roomSetProgress(
                            room.id,
                            're-signalling the host'
                        );

                        await signalling.hostPost(
                            room.signalId,
                            room.localSessionDescription,
                            '',
                            room.signalAccessKey,
                            're-signalling the host'
                        );

                    } else {
                        const guestSignalJson = await guestSignal.json();
                        if (guestSignalJson.guestDescription) {
                            await peerConnection.setRemoteDescription(
                                JSON.parse(atob(guestSignalJson.guestDescription))
                            );

                            break;
                        }

                        throw new webrtcElements.ControlledError('see what happens 2');
                    }
                }
            } else {
                await signalling.hostGet(
                    room,
                    'preparing'
                );
                if (room.remoteSessionDescription) {
                    prepareDataChannel(room, peerConnection);

                    const rd = JSON.parse(atob(room.remoteSessionDescription));
                    await peerConnection.setRemoteDescription(rd);

                    const answerDescription = await peerConnection.createAnswer();
                    peerConnection.setLocalDescription(answerDescription);
                } else if (room.remoteCandidates) {
                    for (const candidate of room.remoteCandidates) {

                        const cd = JSON.parse(atob(candidate));
                        await peerConnection.addIceCandidate(cd);
                    }
                    const answerDescription = await peerConnection.createAnswer();
                    peerConnection.setLocalDescription(answerDescription);
                }

                pageElements.roomSetProgress(
                    room.id,
                    'collecting all ice candidates'
                );

                const localSessionDescription = await waitForLocalDescription(room);

                const guestSignal =
                    await fetch(
                        'api/guest',
                        {
                            method: 'POST',
                            body: JSON.stringify({
                                hostId: room.signalId,
                                guestDescription: localSessionDescription
                            }),
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

            if (room.meetingType === webrtcElements.MeetingType.GUEST) {
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
    room: webrtcElements.Room
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

    peerConnection.onicecandidate = async (event) => {
        if (event.candidate === null) {
            room.localSessionDescription = btoa(JSON.stringify(peerConnection.localDescription));

            const signalHost = await signalling.hostPost(
                room.signalId,
                room.localSessionDescription,
                '',
                room.signalAccessKey,
                'signalling local session description'
            );
            room.signalId = signalHost.id;
            room.signalAccessKey = signalHost.accessKey;
        } else if (
            room.signalId &&
            room.meetingType === webrtcElements.MeetingType.HOST
        ) {
            try {
                const signalHost = await signalling.hostPost(
                    room.signalId,
                    '',
                    btoa(JSON.stringify(event.candidate)),
                    room.signalAccessKey,
                    'signalling a new candidate'
                );
                room.signalId = signalHost.id;
                room.signalAccessKey = signalHost.accessKey;
            } catch (error) {
                console.error(error);
            }
        } else if (
            room.signalId &&
            room.meetingType === webrtcElements.MeetingType.GUEST
        ) {
            try {

            } catch (error) {
                console.error(error);
            }
        } else if (room.signalId) {
            console.error('such peer connection must not receive candidate events');
        }
    };

    room.meetingType = await (
        async (meetingTypeInsist: webrtcElements.MeetingType|null)
            : Promise<webrtcElements.MeetingType> => {
            if (!room.signalId) {
                return webrtcElements.MeetingType.HOST;
            }

            if (meetingTypeInsist === null) {
                try {
                    await signalling.hostGet(
                        room,
                        'determining meeting type'
                    );
                    return webrtcElements.MeetingType.GUEST;
                } catch (error) {
                    if (error instanceof webrtcElements.ControlledError) {
                        return webrtcElements.MeetingType.HOST;
                    } else {
                        throw error;
                    }
                }
            } else {
                return meetingTypeInsist;
            }
        })(room.meetingType);

    if (room.meetingType === webrtcElements.MeetingType.HOST) {
        const signallingHost =
            await signalling.hostPost(
                room.signalId,
                '',
                '',
                '',
                'signalling the host id the first time'
            );
        room.signalId = signallingHost.id;
        room.signalAccessKey = signallingHost.accessKey;

        if (!media.audio) {
            peerConnection.addTransceiver('audio', { 'direction': 'recvonly' });
        }
        if (!media.video) {
            peerConnection.addTransceiver('video', { 'direction': 'recvonly' });
        }

        prepareDataChannel(room, peerConnection);

        const offer = await peerConnection.createOffer();

        await peerConnection.setLocalDescription(offer);
    } else /*if (room.meetingType === webrtcElements.MeetingType.GUEST) */{
    }

    return room.meetingType;
}

async function waitForLocalDescription(
    room: webrtcElements.Room
): Promise<string> {
    while (!room.localSessionDescription) {
        await new Promise(resolve => setTimeout(resolve, 25));
        pageElements.assertRoomActive(room.id);
    }

    const localSessionDescription = room.localSessionDescription!;
    room.localSessionDescription = '';
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
