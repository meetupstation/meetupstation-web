import * as pageElements from './pageElements.js';
import * as webrtcElements from './webrtcElements.js';

class ControlledError extends Error {
    constructor(message: string) {
        super(message);
    }
}
export async function meet(
    roomId:number,
    rooms: Map<string, webrtcElements.Room>
): Promise<void> {

    let meetingType: webrtcElements.MeetingType|null = null;

    do {
        const roomMaybeUndefined = rooms.get(`${roomId}`);
        if (!roomMaybeUndefined) {
            throw new Error('undefined room object');
        }

        const room = roomMaybeUndefined!;

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
                    meetingType
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
                    throw new ControlledError('host already exists, while trying to create a new one');
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

                        const hostSignal =
                            await fetch(
                                'api/host',
                                {
                                    method: 'POST',
                                    body: `{"id": "${pageElements.getRoomIdentifier(room.id)}", "description": "${localSessionDescription}"}`,
                                    headers: {
                                        'Content-type': 'application/json; charset=UTF-8'
                                    }
                                }
                            );

                        if (!hostSignal.ok) {
                            throw new ControlledError('while trying to establish the host id');
                        }

                        const hostSignalJson = await hostSignal.json();
                        pageElements.setRoomIdentifier(room.id, hostSignalJson.id);
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
                    throw new ControlledError('while trying to find the host');
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

                if (error instanceof ControlledError &&
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
    meetingTypeInsist: webrtcElements.MeetingType|null
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

    peerConnection.onicecandidate = (event) => {
        // this is what makes waitForLocalDescription functional
        //
        if (event.candidate === null) {
            // console.log('all ice candidates', event);
            const ld = JSON.stringify(peerConnection.localDescription);
            room.localSessionDescription = btoa(ld);
        }
    };

    let hostSignal: Response|null = null;

    if (meetingTypeInsist === null ||
        meetingTypeInsist === webrtcElements.MeetingType.GUEST) {

        const hostId = pageElements.getRoomIdentifier(room.id);
        if (!hostId) {
            if (meetingTypeInsist === null) {
                meetingTypeInsist = webrtcElements.MeetingType.HOST;
            } else {
                throw new Error(`roomId: ${room.id}, empty hostId`);
            }
        } else {
            hostSignal = await fetch(`api/host?id=${hostId}`, {
                method: 'GET'
            });

            if (!hostSignal.ok) {
                if (meetingTypeInsist === null) {
                    meetingTypeInsist = webrtcElements.MeetingType.HOST;
                } else {
                    throw new ControlledError(`roomId: ${room.id}, host not set up`);
                }
            } else {
                meetingTypeInsist = webrtcElements.MeetingType.GUEST;
            }
        }
    }

    if (meetingTypeInsist === webrtcElements.MeetingType.GUEST) {
        const hostSignalJson = await hostSignal!.json();

        const rd = JSON.parse(atob(hostSignalJson.description));

        prepareDataChannel(room, peerConnection);

        await peerConnection.setRemoteDescription(rd);

        const answerDescription = await peerConnection.createAnswer();
        peerConnection.setLocalDescription(answerDescription);

        return webrtcElements.MeetingType.GUEST;
    } else/* if (meetingTypeEnforce === MeetingType.HOST)*/ {
        if (!media.audio) {
            peerConnection.addTransceiver('audio', { 'direction': 'recvonly' });
        }
        if (!media.video) {
            peerConnection.addTransceiver('video', { 'direction': 'recvonly' });
        }

        prepareDataChannel(room, peerConnection);

        const offer = await peerConnection.createOffer();

        await peerConnection.setLocalDescription(offer);

        return webrtcElements.MeetingType.HOST;
    }
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
            throw new ControlledError(`roomId: ${room.id} gave up while waiting for ice connection`);
        }
    }

    if (peerConnection.iceConnectionState !== 'connected') {
        throw new ControlledError(`unexpected iceConnectionState (connected?) while waiting for ice connection: ${peerConnection.iceConnectionState}`);
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
        throw new ControlledError(`unexpected iceConnectionState (disconnected?) while waiting for ice connection: ${peerConnection.iceConnectionState}`);
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
