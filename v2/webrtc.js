const MeetingType = {
    HOST: 'HOST',
    GUEST: 'GUEST'
};

async function meet(roomId, rooms) {
    let phase = '';

    while (true) {
        try {
            const room = rooms[roomId];

            const peerConnectionId = `${Object.keys(room.peerConnections).length}`;


            pageSetProgress('creating the peer connection');
            phase = 'initializePeerConnection';
            const peerConnection = await initializePeerConnection(roomId, peerConnectionId);

            room.peerConnections[peerConnectionId] = peerConnection;

            pageSetProgress('creating the guest answer or the host offer');
            phase = 'prepareGuestAnswerOrHostOffer';
            const meetingType = await prepareGuestAnswerOrHostOffer(peerConnection, roomId, rooms);

            pageSetProgress('waiting for all ice candidates');
            phase = 'waitForLocalDescription';
            await waitForLocalDescription(roomId, rooms);

            let localSessionDescription = null;
            if (rooms && rooms[roomId]) {
                localSessionDescription = rooms[roomId].localSessionDescription;
            } else {
                return;
            }

            phase = 'signalling';
            pageSetProgress('signalling on the room id');

            if (meetingType === MeetingType.HOST) {

                let hostSignal = await fetch(`${window.location.origin}/api/host?id=${pageGetRoomId(roomId)}`, {
                    method: 'GET'
                });

                if (hostSignal.ok) {
                    setBreakOnException(roomId, rooms, false);
                    throw Error('host already exists');
                }

                if (!rooms || !rooms[roomId]) {
                    return;
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
                phase = 'wait for guest';
                pageSetProgress('waiting for the guest to join...');

                const hostId = pageGetRoomId(roomId);
                while (true) {
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

            pageSetProgress('connecting...');
            phase = 'waitForIceConnected';
            await waitForIceConnected(roomId, rooms, peerConnection);

            const localIpAddress = getIpAddressUtility(peerConnection.localDescription);
            const remoteIpAddress = getIpAddressUtility(peerConnection.remoteDescription);

            pageSetProgress(`connected:${localIpAddress}<=>${remoteIpAddress}`);

            setUpDataChannelUtility();

            phase = 'waitForIceDisonnected';
            await waitForIceDisonnected(roomId, rooms, peerConnection);
            pageNotify('disconnected');
        } catch (error) {
            console.error(`cought - ${phase}: ${error}`);
            pageNotify(`${phase}: ${error}`);

            const room = rooms[roomId];
            if (room && !room.breakOnException) {
                room.breakOnException = true;
                continue;
            }
        }
        break;
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

async function prepareGuestAnswerOrHostOffer(peerConnection, roomId, rooms) {
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

    let hostAlreadyCreated = false;
    let hostSignal = null;
    const hostId = pageGetRoomId(roomId);

    if (!hostId) {
        hostAlreadyCreated = false;
    } else {
        hostSignal = await fetch(`${window.location.origin}/api/host?id=${hostId}`, {
            method: 'GET'
        });

        if (!hostSignal.ok) {
            hostAlreadyCreated = false;
        } else {
            hostAlreadyCreated = true;
        }
    }

    if (hostAlreadyCreated) {
        const hostSignalJson = await hostSignal.json();

        const rd = JSON.parse(atob(hostSignalJson.description));

        prepareDataChannel(peerConnection, rooms);

        await peerConnection.setRemoteDescription(rd);

        const answerDescription = await peerConnection.createAnswer();
        peerConnection.setLocalDescription(answerDescription);

        return MeetingType.GUEST;
    } else {
        if (!media.audio) {
            peerConnection.addTransceiver('audio', { 'direction': 'recvonly' });
        }
        if (!media.video) {
            peerConnection.addTransceiver('video', { 'direction': 'recvonly' });
        }

        prepareDataChannel(peerConnection, rooms);

        const offer = await peerConnection.createOffer();

        await peerConnection.setLocalDescription(offer);

        return MeetingType.HOST;
    }
}

async function waitForLocalDescription(roomId, rooms) {
    while (!rooms[roomId] || !rooms[roomId].localSessionDescription) {
        await new Promise(resolve => setTimeout(resolve, 25));
    }
}

async function waitForIceConnected(roomId, rooms, peerConnection) {
    while (['new', 'checking', 'disconnected'].indexOf(peerConnection.iceConnectionState) !== -1) {
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    if (peerConnection.iceConnectionState !== 'connected') {
        setBreakOnException(roomId, rooms, false);
        throw Error(`unexpected iceConnectionState (connected?): ${peerConnection.iceConnectionState}`);
    }
}

async function waitForIceDisonnected(roomId, rooms, peerConnection) {
    let dataChannel;
    if (!rooms[roomId] || !rooms[roomId].dataChannel ) {
        dataChannel = null;
    } else {
        dataChannel = rooms[roomId].dataChannel;
    }
    let haveDataChannel = !!dataChannel;

    while (peerConnection.iceConnectionState === 'connected') {
        if (!rooms[roomId] || !rooms[roomId].dataChannel ) {
            dataChannel = null;
        } else {
            dataChannel = rooms[roomId].dataChannel;
        }
        if (haveDataChannel === true && dataChannel === null) {
            pageResetDataControllers();
        }
        haveDataChannel = !!dataChannel;

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
        rooms[roomId].dataChannel = dataChannel;
        dataChannel.onmessage = (message) => {
            dataChannelHandler(message.data);
            console.log(message.data);
        }
    };
    dataChannel.onclose = () => {
        rooms[roomId].dataChannel = null;
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

function setUpDataChannelUtility() {}

function dataChannelHandler(message) {}