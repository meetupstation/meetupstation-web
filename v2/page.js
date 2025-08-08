function newRoom(rooms) {
    const nextRoomIdLabel = document.getElementById('nextRoomId');

    const roomId = parseInt(nextRoomIdLabel.innerText);
    nextRoomIdLabel.innerText = `${roomId + 1}`;

    rooms[`${roomId}`] = {
        peerConnections: {},
        localSessionDescription: null,
        dataChannel: null,
        breakOnException: true
    };

    const roomControlPanelDiv = document.createElement('div');
    roomControlPanelDiv.innerHTML = `
    <div class='roomControlPanel' id='roomControlPanel${roomId}'>
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
            <input type='checkbox' id='roomControlTogglePause${roomId}' checked>
            <label for='roomControlTogglePause${roomId}'>
            🔁
            </label>
            <label for='roomControlTogglePause${roomId}'>
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
    document.getElementById('roomControlList').appendChild(roomControlPanelDiv);
}

function deleteRoom(roomId, rooms) {
    delete rooms[roomId];
    document.getElementById(`roomControlPanel${roomId}`).remove();
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
            pageSetProgress(roomId, 'stopped');

            const roomStopping = document.getElementById(`roomStopping${roomId}`);
            if (roomStopping) {
                roomStopping.remove();
            }
        } catch (error) {
            roomErrorLabel = document.getElementById(`roomError${roomId}`);
            if (roomErrorLabel) {
                roomErrorLabel.innerText = error;
            }
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

function pageSetRemoteVideoStream(roomId, rooms, peerId, stream) {
    if (rooms[roomId] === undefined) {
        return;
    }

    const remoteVideosDiv = document.getElementById('remoteVideos');
    if (!remoteVideosDiv) {
        return;
    }

    const remoteVideoDiv = document.createElement('div');
    remoteVideoDiv.innerHTML = `
    <div>
        <video id='remoteVideo_${roomId}_${peerId}' autoplay controls playsinline></video>
    </div>`;
    remoteVideosDiv.appendChild(remoteVideoDiv);
    const remotePlayer = document.getElementById(`remoteVideo_${roomId}_${peerId}`);
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
    }
}
function pageRoomStop(roomId) {
    const roomControlPanel = document.getElementById(`roomControlPanel${roomId}`);
    if (!document.getElementById(`roomStopping${roomId}`)) {
        const roomStopping = document.createElement('label');
        roomStopping.id = `roomStopping${roomId}`;
        roomControlPanel.appendChild(roomStopping);
    }
}

function pageRoomStopping(roomId) {
    if (document.getElementById(`roomStopping${roomId}`) || !document.getElementById(`roomControlPanel${roomId}`)) {
        return true;
    }

    return false;
}

function pageResetDataControllers() { }