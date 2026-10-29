import * as signalling from './signalling.js';

export class Peer {
    peerConnection: RTCPeerConnection;
    connectionId: number;

    constructor(connectionId: number,
        peerConnection: RTCPeerConnection
    ) {
        this.connectionId = connectionId;
        this.peerConnection = peerConnection;
    }
}

export class Room {
    id: number;
    signalling: signalling.SignallingScope;
    meetingType: signalling.MeetingType|null = null;
    peers: Map<number, Peer> = new Map();
    _peerConnectionId: number = 1;

    constructor(id: number,
        hostId: string,
        server: string) {
        this.id = id;
        this.signalling = new signalling.SignallingScope(hostId, server);
    }

    getPeer(peerConnectionId: number) : Peer {
        return this.peers.get(peerConnectionId)!;
    }

    getAndUpdatePeerConnectionId() : number {
        const peerConnectionId = this._peerConnectionId;

        do {
            ++this._peerConnectionId;
            if (this._peerConnectionId == 999999) {
                this._peerConnectionId = 0;
            }
        } while (this._peerConnectionId == 0);

        return peerConnectionId;
    }

    async initializePeerConnection(
        peerConnectionId: number,
        rtcConfiguration: RTCConfiguration
    ): Promise<void> {
        const peerConnection = new RTCPeerConnection(rtcConfiguration);

        this.peers.set(peerConnectionId, new Peer(peerConnectionId, peerConnection));
    }

    async setupTracksAndDataHandlers(peerConnection: RTCPeerConnection): Promise<void> {
        // const media = await pageElements.getUserMedia(room.id);
        // if (media.stream) {
        //     for (const track of media.stream.getTracks()) {
        //         peerConnection.addTrack(track, media.stream);
        //     }

        //     pageElements.roomSetLocalVideoStream(
        //         room.id,
        //         media.stream
        //     );
        // }

        peerConnection.addTransceiver('audio', { 'direction': 'sendrecv' });
        peerConnection.addTransceiver('video', { 'direction': 'sendrecv' });

        peerConnection.onicecandidate = (event) => {
            if (event.candidate === null) {
                this.signalling.localSessionDescription =
                btoa(JSON.stringify(peerConnection.localDescription));
            } else {
                this.signalling.localCandidates.push(btoa(JSON.stringify(event.candidate)));
            }
        };
    }

    async ifHostPrepareOffer(peerConnection: RTCPeerConnection): Promise<void> {
        this.meetingType = await (
            async (meetingTypeInsist: signalling.MeetingType|null)
                : Promise<signalling.MeetingType> => {
                if (!this.signalling.id) {
                    return signalling.MeetingType.HOST;
                }

                if (meetingTypeInsist === null) {
                    try {
                        await this.signalling.hostGet();
                        return signalling.MeetingType.GUEST;
                    } catch (error) {
                        if (this.signalling.complete) {
                            this.signalling.complete = false;
                            return signalling.MeetingType.HOST;
                        } else {
                            throw error;
                        }
                    }
                } else {
                    return meetingTypeInsist;
                }
            })(this.meetingType);

        if (this.meetingType === signalling.MeetingType.HOST) {
            await this.signalling.hostPost();

            const offer = await peerConnection.createOffer();

            await peerConnection.setLocalDescription(offer);
        } else /*if (room.meetingType === webrtcElements.MeetingType.GUEST) */{
        }
    }

    async waitForIceConnected(peerConnection: RTCPeerConnection): Promise<void> {
        const stepWait = 200;

        const startTime = Date.now();

        while (
            [
                'new',
                'checking'
            ].indexOf(peerConnection.iceConnectionState) !== -1
        ) {
            await this.signalling.polling(peerConnection, this.meetingType!);

            await new Promise(resolve => setTimeout(resolve, stepWait));

            if (Date.now() - startTime >= 20_000) {
                throw new Error(`roomId: ${this.id} - ice connection time out`);
            }
        }

        if (peerConnection.iceConnectionState !== 'connected') {
            throw new Error(`unexpected iceConnectionState (connected?) while waiting for ice connection: ${peerConnection.iceConnectionState}`);
        }
    }

    async waitForIceDisonnected(peerConnection: RTCPeerConnection): Promise<void> {
        const stepWait = 200;

        while (peerConnection.iceConnectionState === 'connected') {
            await this.signalling.polling(peerConnection, this.meetingType!);

            await new Promise(resolve => setTimeout(resolve, stepWait));
        }

        if (peerConnection.iceConnectionState !== 'disconnected') {
            throw new Error(`unexpected iceConnectionState (disconnected?) while waiting for ice connection: ${peerConnection.iceConnectionState}`);
        }
    }
}

export async function Sleep(milliSeconds: number) {
    await new Promise(resolve => setTimeout(resolve, milliSeconds));
}
