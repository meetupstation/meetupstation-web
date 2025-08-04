function newRoom(rooms) {
    let roomId = `${Object.keys(rooms).length}`;
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
        <input type='checkbox' id='roomControlToggleCamera${roomId}'>
        <label for='roomControlToggleCamera${roomId}'>
        🎦
        </label>
        <input type='checkbox' id='roomControlToggleMicrophone${roomId}'>
        <label for='roomControlToggleMicrophone${roomId}'>
        ⏺️
        </label>
        <input type='checkbox' id='roomControlTogglePlay${roomId}' onclick='pageRoomControlTogglePlay(${roomId}, rooms, this.checked);'>
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
    </div>`;
    document.getElementById('roomControlList').appendChild(roomControlPanelDiv);
}

function deleteRoom(roomId, rooms) {
    delete rooms[roomId];
    document.getElementById(`roomControlPanel${roomId}`).remove();
}

async function pageRoomControlTogglePlay(roomId, rooms, checked) {
    let elements = [
        document.getElementById(`roomId${roomId}`),
        document.getElementById(`roomControlToggleCamera${roomId}`),
        document.getElementById(`roomControlToggleMicrophone${roomId}`)
    ];
    if (checked) {
        for (const element of elements) {
            element.setAttribute('disabled', 'disabled');
        }
        await meet(roomId, rooms);
    } else {
        for (const element of elements) {
            element.removeAttribute('disabled');
        }
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

function pageNotify() { }
function pageSetLocalVideoStream() { }
function pageSetProgress() { }
function pageResetDataControllers() {}