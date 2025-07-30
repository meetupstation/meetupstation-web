function pageStartCall() {
    document.getElementById('media').disabled = true;
    document.getElementById('progress').innerText = 'starting the call';
    document.getElementById('hostId').type = "hidden";
    document.getElementById('hostIdDisplay').innerText = document.getElementById('hostId').value;
    document.getElementById('hostButton').disabled = true;
    document.getElementById('guestButton').disabled = true;

    pageResetDataControllers();
}

function pageEndCall() {
    document.getElementById('media').disabled = false;
    document.getElementById('progress').innerText = '';
    document.getElementById('hostId').value = '';
    document.getElementById('hostId').type = "text";
    document.getElementById('hostIdDisplay').innerText = '';
    document.getElementById('hostButton').disabled = false;
    document.getElementById('guestButton').disabled = false;

    pageResetDataControllers();
}

function pageResetDataControllers() {
    
}

function pageSetLocalVideoStream(stream) {
    const localPlayer = document.getElementById('localVideo');
    localPlayer.srcObject = stream;
}

function pageSetRemoteVideoStream(stream) {
    const remotePlayer = document.getElementById('remoteVideo');
    remotePlayer.srcObject = stream;

    // var el = document.createElement(event.track.kind);
    // el.srcObject = event.streams[0];
    // el.autoplay = true;
    // el.controls = true;

    // document.getElementById('remoteVideos').appendChild(el);
}

function pageHostId() {
    return document.getElementById('hostId').value;
}

function pageSetHostId(id) {
    document.getElementById('hostId').value = id;
    document.getElementById('hostIdDisplay').innerText = document.getElementById('hostId').value;
}

function pageSetProgress(progress) {
    document.getElementById('progress').innerText = progress;
}

function pageNotify(message) {
    alert(message);
}

async function pageGetUserMedia() {
    const result = {
        stream: null,
        audio: false,
        video: false
    };

    const mediaElement = document.getElementById('media');
    if (mediaElement.value === 'None') {
        result.stream = null;
    } else if (mediaElement.value === 'Audio') {
        result.stream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: true
        });
        result.audio = true;
    } else if (mediaElement.value === 'Video') {
        result.stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });
        result.audio = true;
        result.video = true;
    } else if (mediaElement.value === 'Video HQ') {
        result.stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'environment'
            },
            audio: true
        });
        result.audio = true;
        result.video = true;
    }

    return result;
}