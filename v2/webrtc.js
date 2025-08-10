const MeetingType = {
    HOST: 'HOST',
    GUEST: 'GUEST'
};

async function meet(roomId, rooms) {

    let meetingType = null;
    while (true) {
        try {
            const room = rooms[roomId];

            const peerConnectionId = `${room.nextPeerConnectionId}`;
            room.nextPeerConnectionId++;

            pageSetProgress(roomId, 'creating the peer connection');

            if (pageRoomStopping(roomId)) {
                break;
            }

            const peerConnection = await initializePeerConnection(roomId, peerConnectionId);

            room.peerConnections[peerConnectionId] = peerConnection;

            pageSetProgress(roomId, 'creating the guest answer or the host offer');

            if (pageRoomStopping(roomId)) {
                break;
            }

            meetingType = await prepareGuestAnswerOrHostOffer(peerConnection, roomId, rooms, meetingType);

            pageSetProgress(roomId, 'collecting all ice candidates');

            if (pageRoomStopping(roomId)) {
                break;
            }

            await waitForLocalDescription(roomId, rooms);

            if (pageRoomStopping(roomId)) {
                break;
            }

            const localSessionDescription = rooms[roomId].localSessionDescription;


            pageSetProgress(roomId, 'signalling on the room id');

            if (meetingType === MeetingType.HOST) {

                let hostSignal = await fetch(`${window.location.origin}/api/host?id=${pageGetRoomId(roomId)}`, {
                    method: 'GET'
                });

                if (hostSignal.ok) {
                    setBreakOnException(roomId, rooms, false);
                    throw Error('host already exists');
                }

                if (pageRoomStopping(roomId)) {
                    break;
                }

                hostSignal = await fetch(`${window.location.origin}/api/host`, {
                    method: 'POST',
                    body: `{"id": "${pageGetRoomId(roomId)}", "description": "${localSessionDescription}"}`,
                    headers: {
                        'Content-type': 'application/json; charset=UTF-8'
                    }
                });

                if (!hostSignal.ok) {
                    setBreakOnException(roomId, rooms, false);
                    throw Error('cannot establish the host id');
                }

                const hostSignalJson = await hostSignal.json();
                pageSetRoomId(roomId, hostSignalJson.id);
            } else {

                const guestSignal = await fetch(`${window.location.origin}/api/guest`, {
                    method: 'POST',
                    body: `{"hostId": "${pageGetRoomId(roomId)}", "guestDescription": "${localSessionDescription}"}`,
                    headers: {
                        'Content-type': 'application/json; charset=UTF-8'
                    }
                });

                if (!guestSignal.ok) {
                    setBreakOnException(roomId, rooms, false);
                    throw Error('host not found');
                }

                const guestSignalJson = await guestSignal.json();
            }

            if (meetingType === MeetingType.HOST) {
                pageSetProgress(roomId, 'waiting for the guest to join...');

                const hostId = pageGetRoomId(roomId);
                while (true) {

                    if (pageRoomStopping(roomId)) {
                        break;
                    }
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    const guestSignal = await fetch(`${window.location.origin}/api/guest?hostId=${hostId}`, {
                        method: 'GET'
                    });

                    if (!guestSignal.ok) {
                        setBreakOnException(roomId, rooms, false);
                        throw Error('guest not available');
                    }

                    const guestSignalJson = await guestSignal.json();
                    if (guestSignalJson.guestDescription) {
                        await peerConnection.setRemoteDescription(JSON.parse(atob(guestSignalJson.guestDescription)));

                        break;
                    }
                }
            }

            if (pageRoomStopping(roomId)) {
                break;
            }

            pageSetProgress(roomId, 'connecting...');
            await waitForIceConnected(roomId, rooms, peerConnection);

            pageSetProgress(roomId, '');

            if (pageRoomStopping(roomId)) {
                break;
            }

            const localIpAddress = getIpAddressUtility(peerConnection.localDescription);
            const remoteIpAddress = getIpAddressUtility(peerConnection.remoteDescription);

            pageSetPeerConnectionStatus(roomId, peerConnectionId, `${localIpAddress}<=>${remoteIpAddress}`);

            setUpDataChannelUtility();

            let onDisconnect = async () => {
                await waitForIceDisonnected(roomId, rooms, peerConnection);
                pageSetPeerConnectionStatus(roomId, peerConnectionId, `disconnected`);
                pageRemoveRemoteVideo(roomId, peerConnectionId);
            }
            let promiseDisconnected = onDisconnect();

            if (meetingType === MeetingType.GUEST) {
                await promiseDisconnected;
            }

        } catch (error) {
            console.error(`caught: ${error}`);

            pageRemoveRemoteVideo(roomId, peerConnectionId);
            
            const room = rooms[roomId];
            if (room && !room.breakOnException) {
                room.breakOnException = true;

                const checkBoxRepeat = document.getElementById(`roomControlToggleRepeat${roomId}`);
                if (checkBoxRepeat && checkBoxRepeat.checked) {
                    continue;
                }
            }

            throw error;
        }

        const checkBoxRepeat = document.getElementById(`roomControlToggleRepeat${roomId}`);
        if (!checkBoxRepeat || !checkBoxRepeat.checked) {
            break;
        }
    }
}

async function initializePeerConnection(roomId, peerId) {
    const peerConnection = new RTCPeerConnection({
        iceServers: [{
            urls: 'stun:stun.l.google.com:19302'
        }]
    });
    // stun:stun.l.google.com:19302
    // stun:stun.stunprotocol.org

    peerConnection.ontrack = function (event) {
        pageSetRemoteVideoStream(roomId, rooms, peerId, event.streams[0]);
    };

    return peerConnection;
}

async function prepareGuestAnswerOrHostOffer(peerConnection, roomId, rooms, meetingTypeEnforce) {
    const media = await pageGetUserMedia(roomId);
    if (media.stream) {
        for (const track of media.stream.getTracks()) {
            peerConnection.addTrack(track, media.stream);
        }

        pageSetLocalVideoStream(media.stream);
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

    let hostSignal = null;

    if (meetingTypeEnforce === null ||
        meetingTypeEnforce === MeetingType.GUEST) {

        const hostId = pageGetRoomId(roomId);
        if (!hostId) {
            if (meetingTypeEnforce === null) {
                meetingTypeEnforce = MeetingType.HOST;
            } else {
                throw Error(`roomId: ${roomId}, empty hostId`);
            }
        } else {
            hostSignal = await fetch(`${window.location.origin}/api/host?id=${hostId}`, {
                method: 'GET'
            });

            if (!hostSignal.ok) {
                if (meetingTypeEnforce === null) {
                    meetingTypeEnforce = MeetingType.HOST;
                } else {
                    setBreakOnException(roomId, rooms, false);
                    throw Error(`roomId: ${roomId}, host not set up`);
                }
            } else {
                meetingTypeEnforce = MeetingType.GUEST;
            }
        }
    }

    if (meetingTypeEnforce === MeetingType.GUEST) {
        const hostSignalJson = await hostSignal.json();

        const rd = JSON.parse(atob(hostSignalJson.description));

        prepareDataChannel(peerConnection, roomId, rooms);

        await peerConnection.setRemoteDescription(rd);

        const answerDescription = await peerConnection.createAnswer();
        peerConnection.setLocalDescription(answerDescription);

        return MeetingType.GUEST;
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

        return MeetingType.HOST;
    }
}

async function waitForLocalDescription(roomId, rooms) {
    while (rooms[roomId] && !rooms[roomId].localSessionDescription) {
        await new Promise(resolve => setTimeout(resolve, 25));
        if (pageRoomStopping(roomId)) {
            break;
        }
    }
}

async function waitForIceConnected(roomId, rooms, peerConnection) {
    const stepWait = 25;
    const timeOut = 60 * 1000 / stepWait;

    let steps = 0;
    while (['new', 'checking', 'disconnected'].indexOf(peerConnection.iceConnectionState) !== -1) {
        await new Promise(resolve => setTimeout(resolve, stepWait));

        ++steps;
        if (pageRoomStopping(roomId)) {
            return;
        }

        if (steps == timeOut) {
            setBreakOnException(roomId, rooms, false);
            throw Error(`roomId: ${roomId} give up connecting`);
        }
    }

    if (peerConnection.iceConnectionState !== 'connected') {
        setBreakOnException(roomId, rooms, false);
        throw Error(`unexpected iceConnectionState (connected?): ${peerConnection.iceConnectionState}`);
    }
}

async function waitForIceDisonnected(roomId, rooms, peerConnection) {
    const room = rooms[roomId];

    if (!room || pageRoomStopping(roomId)) {
        return;
    }

    let dataChannel = room.dataChannel;
    while (peerConnection.iceConnectionState === 'connected') {
        if (!room || pageRoomStopping(roomId)) {
            return;
        }

        if (!!dataChannel === true && room.dataChannel === null) {
            pageResetDataControllers();
        }
        dataChannel = room.dataChannel;

        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (peerConnection.iceConnectionState !== 'disconnected') {
        setBreakOnException(roomId, rooms, false);
        throw Error(`unexpected iceConnectionState (disconnected?): ${peerConnection.iceConnectionState}`);
    }
}

function prepareDataChannel(peerConnection, roomId, rooms) {
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
            }
        }
    };
    dataChannel.onclose = () => {
        if (rooms[roomId]) {
            rooms[roomId].dataChannel = null;
        }
    };
}

function setBreakOnException(roomId, rooms, value) {
    if (rooms[roomId]) {
        rooms[roomId].breakOnException = value;
    }
}

function getIpAddressUtility(description) {
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

function setUpDataChannelUtility() { }

function dataChannelHandler(message) { }