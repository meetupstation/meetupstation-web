import * as pageElements from './pageElements';
import * as webrtcElements from './webrtcElements';

export async function meet(
    roomId:number,
    rooms:[webrtcElements.Room]
): Promise<void> {

    let meetingType: webrtcElements.MeetingType|null = null;

    while (true) {
        const room = rooms[roomId];
        const peerConnectionId = `${room.nextPeerConnectionId}`;
        try {
            room.nextPeerConnectionId++;

            pageElements.roomSetProgress(
                roomId,
                'creating the peer connection'
            );

            if (pageElements.roomPausing(roomId)) {
                break;
            }

            const peerConnection =
                await initializePeerConnection(
                    roomId,
                    rooms,
                    peerConnectionId
                );

            room.peerConnections.set(peerConnectionId, peerConnection);

            pageElements.roomSetProgress(
                roomId,
                'creating the guest answer or the host offer'
            );

            if (pageElements.roomPausing(roomId)) {
                break;
            }

            meetingType =
                await prepareGuestAnswerOrHostOffer(
                    peerConnection,
                    roomId,
                    rooms,
                    meetingType
                );

            pageElements.roomSetProgress(
                roomId,
                'collecting all ice candidates'
            );

            if (pageElements.roomPausing(roomId)) {
                break;
            }

            await waitForLocalDescription(roomId, rooms);

            if (pageElements.roomPausing(roomId)) {
                break;
            }
            const localSessionDescription = rooms[roomId].localSessionDescription;
            rooms[roomId].localSessionDescription = null; // set null, to be used for the next round

            pageElements.roomSetProgress(
                roomId,
                'signalling on the room id'
            );

            if (meetingType === webrtcElements.MeetingType.HOST) {

                const hostSignal =
                    await fetch(
                        `api/host?id=${pageElements.getRoomId(roomId)}`,
                        {
                            method: 'GET'
                        }
                    );

                if (hostSignal.ok) {
                    roomSetBreakOnException(roomId, rooms, false);
                    throw Error('host already exists, while trying to create a new one');
                }

                if (pageElements.roomPausing(roomId)) {
                    break;
                }

                //
                pageElements.roomSetProgress(
                    roomId,
                    'waiting for the guest to join...'
                );

                {
                    while (true) {

                        if (pageElements.roomPausing(roomId)) {
                            break;
                        }
                        await new Promise(resolve => setTimeout(resolve, 1000));

                        const guestSignal =
                            await fetch(
                                `api/guest?hostId=${pageElements.getRoomId(roomId)}`,
                                {
                                    method: 'GET'
                                }
                            );

                        if (!guestSignal.ok) {
                            // maybe the host is expired
                            // will recreate
                            const hostSignal =
                                await fetch(
                                    'api/host',
                                    {
                                        method: 'POST',
                                        body: `{"id": "${pageElements.getRoomId(roomId)}", "description": "${localSessionDescription}"}`,
                                        headers: {
                                            'Content-type': 'application/json; charset=UTF-8'
                                        }
                                    }
                                );

                            if (!hostSignal.ok) {
                                roomSetBreakOnException(roomId, rooms, false);
                                throw Error('while trying to establish the host id');
                            }

                            const hostSignalJson = await hostSignal.json();
                            pageElements.setRoomId(roomId, hostSignalJson.id);
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
                }
            } else {

                const guestSignal =
                    await fetch(
                        'api/guest',
                        {
                            method: 'POST',
                            body: `{"hostId": "${pageElements.getRoomId(roomId)}", "guestDescription": "${localSessionDescription}"}`,
                            headers: {
                                'Content-type': 'application/json; charset=UTF-8'
                            }
                        }
                    );

                if (!guestSignal.ok) {
                    roomSetBreakOnException(roomId, rooms, false);
                    throw Error('while trying to find the host');
                }

                //const _guestSignalJson = 
                await guestSignal.json();
            }

            if (pageElements.roomPausing(roomId)) {
                break;
            }

            pageElements.roomSetProgress(
                roomId,
                'connecting...'
            );
            await waitForIceConnected(roomId, rooms, peerConnection);

            pageElements.roomSetProgress(roomId, '');

            if (pageElements.roomPausing(roomId)) {
                break;
            }

            const localIpAddress = getIpAddressUtility(peerConnection.localDescription);
            const remoteIpAddress = getIpAddressUtility(peerConnection.remoteDescription);

            pageElements.roomSetPeerConnectionStatus(
                roomId,
                peerConnectionId,
                `${localIpAddress}<=>${remoteIpAddress}`
            );

            setUpDataChannelUtility();

            const handleDisconnect = async () => {
                await waitForIceDisonnected(roomId, rooms, peerConnection);
                pageElements.roomSetPeerConnectionStatus(
                    roomId,
                    peerConnectionId,
                    'disconnected'
                );
                pageElements.roomRemoveRemoteVideo(roomId, peerConnectionId);

                if (peerConnection) {
                    peerConnection.close();
                    rooms[roomId].peerConnections.delete(peerConnectionId);
                }
            };
            const promiseDisconnected = handleDisconnect();

            if (meetingType === webrtcElements.MeetingType.GUEST) {
                await promiseDisconnected;
            }
        } catch (error) {
            console.error(`caught: ${error}`);

            pageElements.roomRemoveRemoteVideo(roomId, peerConnectionId);
            const peerConnection =
                rooms[roomId].peerConnections.get(peerConnectionId);
            if (peerConnection) {
                peerConnection.close();
                rooms[roomId].peerConnections.delete(peerConnectionId);
            }

            const room = rooms[roomId];
            if (room && !room.breakOnException) {
                room.breakOnException = true;

                if (pageElements.roomRepeatChecked(roomId)) {
                    continue;
                }
            }

            throw error;
        }

        if (!pageElements.roomRepeatChecked(roomId)) {
            break;
        }
    }
}

async function initializePeerConnection(
    roomId: number,
    rooms:[webrtcElements.Room],
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
            rooms,
            peerId,
            event.streams[0]
        );
    };

    return peerConnection;
}

async function prepareGuestAnswerOrHostOffer(
    peerConnection: RTCPeerConnection,
    roomId: number,
    rooms: [webrtcElements.Room],
    meetingTypeInsist: webrtcElements.MeetingType|null
): Promise<webrtcElements.MeetingType> {
    const media = await pageElements.getUserMedia(roomId);
    if (media.stream) {
        for (const track of media.stream.getTracks()) {
            peerConnection.addTrack(track, media.stream);
        }

        pageElements.roomSetLocalVideoStream(
            roomId,
            rooms,
            media.stream);
    }

    peerConnection.onicecandidate = (event) => {
        // this is what makes waitForLocalDescription functional
        //
        if (event.candidate === null) {
            // console.log('all ice candidates', event);
            const ld = JSON.stringify(peerConnection.localDescription);
            if (rooms[roomId]) {
                rooms[roomId].localSessionDescription = btoa(ld);
            }
        }
    };

    let hostSignal: Response|null = null;

    if (meetingTypeInsist === null ||
        meetingTypeInsist === webrtcElements.MeetingType.GUEST) {

        const hostId = pageElements.getRoomId(roomId);
        if (!hostId) {
            if (meetingTypeInsist === null) {
                meetingTypeInsist = webrtcElements.MeetingType.HOST;
            } else {
                throw Error(`roomId: ${roomId}, empty hostId`);
            }
        } else {
            hostSignal = await fetch(`api/host?id=${hostId}`, {
                method: 'GET'
            });

            if (!hostSignal.ok) {
                if (meetingTypeInsist === null) {
                    meetingTypeInsist = webrtcElements.MeetingType.HOST;
                } else {
                    roomSetBreakOnException(roomId, rooms, false);
                    throw Error(`roomId: ${roomId}, host not set up`);
                }
            } else {
                meetingTypeInsist = webrtcElements.MeetingType.GUEST;
            }
        }
    }

    if (meetingTypeInsist === webrtcElements.MeetingType.GUEST) {
        const hostSignalJson = await hostSignal!.json();

        const rd = JSON.parse(atob(hostSignalJson.description));

        prepareDataChannel(peerConnection, roomId, rooms);

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

        prepareDataChannel(peerConnection, roomId, rooms);

        const offer = await peerConnection.createOffer();

        await peerConnection.setLocalDescription(offer);

        return webrtcElements.MeetingType.HOST;
    }
}

async function waitForLocalDescription(
    roomId: number,
    rooms: [webrtcElements.Room]
): Promise<void> {
    while (rooms[roomId] && !rooms[roomId].localSessionDescription) {
        await new Promise(resolve => setTimeout(resolve, 25));
        if (pageElements.roomPausing(roomId)) {
            break;
        }
    }
}

async function waitForIceConnected(
    roomId: number,
    rooms: [webrtcElements.Room],
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
        if (pageElements.roomPausing(roomId)) {
            return;
        }

        if (steps == timeOut) {
            roomSetBreakOnException(roomId, rooms, false);
            throw Error(`roomId: ${roomId} gave up while waiting for ice connection`);
        }
    }

    if (peerConnection.iceConnectionState !== 'connected') {
        roomSetBreakOnException(roomId, rooms, false);
        throw Error(`unexpected iceConnectionState (connected?) while waiting for ice connection: ${peerConnection.iceConnectionState}`);
    }
}

async function waitForIceDisonnected(
    roomId: number,
    rooms: [webrtcElements.Room],
    peerConnection: RTCPeerConnection
): Promise<void> {
    const room = rooms[roomId];

    if (!room) {
        return;
    }

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
        roomSetBreakOnException(roomId, rooms, false);
        throw Error(`unexpected iceConnectionState (disconnected?) while waiting for ice connection: ${peerConnection.iceConnectionState}`);
    }
}

function prepareDataChannel(
    peerConnection: RTCPeerConnection,
    roomId: number,
    rooms: [webrtcElements.Room]
): void {
    const dataChannel = peerConnection.createDataChannel('meetupstation', {
        ordered: true,
        negotiated: true,
        id: 0
    });

    dataChannel.onopen = () => {
        if (rooms[roomId]) {
            rooms[roomId].dataChannel = dataChannel;
            dataChannel.onmessage = (message) => {
                dataChannelHandler(message.data);
                console.log(message.data);
            };
        }
    };
    dataChannel.onclose = () => {
        if (rooms[roomId]) {
            rooms[roomId].dataChannel = null;
        }
    };
}

function roomSetBreakOnException(
    roomId: number,
    rooms: [webrtcElements.Room],
    value: boolean
): void {
    if (rooms[roomId]) {
        rooms[roomId].breakOnException = value;
    }
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