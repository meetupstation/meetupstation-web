function newRoom(rooms) {
    const nextRoomIdLabel = document.getElementById('nextRoomId');

    const roomId = parseInt(nextRoomIdLabel.innerText);
    nextRoomIdLabel.innerText = `${roomId + 1}`;

    rooms[`${roomId}`] = {
        peerConnections: {},
        localSessionDescription: null,
        dataChannel: null,
        breakOnException: true,
        nextPeerConnectionId: 0
    };

    const roomControlPaneDiv = document.createElement('div');
    roomControlPaneDiv.innerHTML = `
    <div class='roomControlPane' id='roomControlPane${roomId}'>
        <input type='text' id='roomId${roomId}'>
        <div>
            <input type='checkbox' id='roomControlToggleCamera${roomId}'>
            <label for='roomControlToggleCamera${roomId}'>
            🎦
            </label>
            <input type='checkbox' id='roomControlToggleMicrophone${roomId}'>
            <label for='roomControlToggleMicrophone${roomId}'>
            ⏺️
            </label>
            <input type='checkbox' id='roomControlTogglePlay${roomId}' onclick='pageRoomControlTogglePlay(${roomId}, rooms, this);'>
            <label for='roomControlTogglePlay${roomId}'>
            ▶️
            </label>
            <button id='roomControlButtonStop${roomId}' onclick='deleteRoom(${roomId}, rooms)'>.
            </button>
            <label for='roomControlButtonStop${roomId}'>
            ⏹️
            </label>
            <input type='checkbox' id='roomControlToggleRepeat${roomId}' checked>
            <label for='roomControlToggleRepeat${roomId}'>
            🔁
            </label>
            <label for='roomControlToggleRepeat${roomId}'>
            🔂
            </label>
        </div>
        <div>
            <label class='roomProgress' id='roomProgress${roomId}'>
            </label>
        </div>
        <div>
            <label class='roomError' id='roomError${roomId}'>
            </label>
        </div>
    </div>`;
    document.getElementById('roomControlList').appendChild(roomControlPaneDiv);
}

function deleteRoom(roomId, rooms) {
    delete rooms[roomId];
    document.getElementById(`roomControlPane${roomId}`).remove();
}

async function pageRoomControlTogglePlay(roomId, rooms, self) {
    let elements = [
        document.getElementById(`roomId${roomId}`),
        document.getElementById(`roomControlToggleCamera${roomId}`),
        document.getElementById(`roomControlToggleMicrophone${roomId}`)
    ];
    pageSetProgress(roomId, '');

    if (self.checked) {
        try {
            for (const element of elements) {
                element.setAttribute('disabled', 'disabled');
            }
            await meet(roomId, rooms);
            pageSetProgress(roomId, '');

            const roomStopping = document.getElementById(`roomStopping${roomId}`);
            if (roomStopping) {
                roomStopping.remove();
            }
        } catch (error) {
            pageSetError(roomId, error);
        }

        self.checked = false;
        for (const element of elements) {
            element.removeAttribute('disabled');
        }
    } else {
        for (const element of elements) {
            element.removeAttribute('disabled');
        }
        self.checked = true;
        pageRoomStop(roomId);
        pageSetProgress(roomId, 'stopping...');
    }
}

function pageRemoveRemoteVideo(roomId, peerId) {
    const remoteVideoPaneDiv = document.getElementById(`remoteVideoPane_${roomId}_${peerId}`);
    if (remoteVideoPaneDiv) {
        remoteVideoPaneDiv.remove();
    }
}

function pageSetRemoteVideoStream(roomId, rooms, peerId, stream) {
    if (rooms[roomId] === undefined) {
        return;
    }

    const remoteVideosPaneDiv = document.getElementById('remoteVideosPane');
    if (!remoteVideosPaneDiv) {
        return;
    }

    let remotePlayer = document.getElementById(`remoteVideo_${roomId}_${peerId}`);
    if (!remotePlayer) {
        remoteVideoStatusLabel = document.createElement('label');
        remoteVideoStatusLabel.id = `remoteVideoStatusLabel_${roomId}_${peerId}`;
        remotePlayer = document.createElement('video');
        remotePlayer.id = `remoteVideo_${roomId}_${peerId}`;
        remotePlayer.setAttribute('autoplay', 'autoplay');
        remotePlayer.setAttribute('controls', 'controls');
        remotePlayer.setAttribute('playsinline', 'playsinline');

        const remoteVideoPaneDiv = document.createElement('div')
        remoteVideoPaneDiv.id = `remoteVideoPane_${roomId}_${peerId}`;

        remoteVideoPaneDiv.appendChild(remotePlayer);
        remoteVideoPaneDiv.appendChild(document.createElement('br'));
        remoteVideoPaneDiv.appendChild(remoteVideoStatusLabel);

        remoteVideosPaneDiv.appendChild(remoteVideoPaneDiv);
    }

    remotePlayer.srcObject = stream;
}

async function pageGetUserMedia(roomId) {
    const result = {
        stream: null,
        audio: false,
        video: false
    };

    const doCamera = document.getElementById(`roomControlToggleCamera${roomId}`).checked;
    const doMicrophone = document.getElementById(`roomControlToggleMicrophone${roomId}`).checked;

    if (!doMicrophone && !doCamera) {
        result.stream = null;
    } else if (doMicrophone && !doCamera) {
        result.stream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: true
        });
        result.audio = true;
    } else if (doCamera) {
        result.stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });
        result.audio = true;
        result.video = true;
    }
    // else if (mediaElement.value === 'Video HQ') {
    //     result.stream = await navigator.mediaDevices.getUserMedia({
    //         video: {
    //             facingMode: 'environment'
    //         },
    //         audio: true
    //     });
    //     result.audio = true;
    //     result.video = true;
    // }

    return result;
}

function pageGetRoomId(roomId) {
    return document.getElementById(`roomId${roomId}`).value;
}

function pageSetRoomId(roomId, id) {
    document.getElementById(`roomId${roomId}`).value = id;
}

function pageSetLocalVideoStream() { }

function pageSetProgress(roomId, value) {
    const roomProgress = document.getElementById(`roomProgress${roomId}`);
    if (roomProgress) {
        roomProgress.innerText = 'ⓘ ' + value;
        pageSetError(roomId, '');
    }
}
function pageSetError(roomId, error) {
    roomErrorLabel = document.getElementById(`roomError${roomId}`);
    if (roomErrorLabel) {
        roomErrorLabel.innerText = error;
    }
}

function pageSetPeerConnectionStatus(roomId, peerConnectionId, value) {
    const remoteVideoStatusLabel = document.getElementById(`remoteVideoStatusLabel_${roomId}_${peerConnectionId}`);
    if (remoteVideoStatusLabel) {
        remoteVideoStatusLabel.innerText = 'ⓘ ' + value;
    }
}

function pageRoomStop(roomId) {
    const roomControlPane = document.getElementById(`roomControlPane${roomId}`);
    if (!document.getElementById(`roomStopping${roomId}`)) {
        const roomStopping = document.createElement('label');
        roomStopping.id = `roomStopping${roomId}`;
        roomControlPane.appendChild(roomStopping);
    }
}

function pageRoomStopping(roomId) {
    if (document.getElementById(`roomStopping${roomId}`) || !document.getElementById(`roomControlPane${roomId}`)) {
        return true;
    }

    return false;
}

function pageResetDataControllers() { }