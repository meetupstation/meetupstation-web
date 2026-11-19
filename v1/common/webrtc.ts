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
    interruptMeet: boolean = false;
    signalling: signalling.SignallingScope;
    meetingType: signalling.MeetingType|null = null;
    peers: Map<number, Peer> = new Map();
    _peerConnectionId: number = 1;

    nextCameraTrackIndex: number = 0;
    cameraTrack: MediaStreamTrack | null = null;
    micTrack: MediaStreamTrack | null = null;

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
        const localStream = new MediaStream();
        peerConnection.addTransceiver('audio',
            {
                direction: 'sendrecv',
                streams: [localStream]
            });
        peerConnection.addTransceiver('video',
            {
                direction:'sendrecv',
                streams: [localStream]
            });
    }

    async setCameraTrack(cameraTrack: MediaStreamTrack | null): Promise<void> {
        this.cameraTrack = cameraTrack;
        for (const [_, peer] of this.peers) {
            const transceivers = peer.peerConnection.getTransceivers();
            for (const transceiver of transceivers) {
                if (transceiver.receiver.track.kind === 'video' &&
                    transceiver.sender.track != cameraTrack
                ) {
                    try {
                        await transceiver.sender.replaceTrack(cameraTrack);
                    } catch (_) {}
                }
            }
        }
    }

    async setMicTrack(micTrack: MediaStreamTrack | null): Promise<void> {
        this.micTrack = micTrack;
        for (const [_, peer] of this.peers) {
            const transceivers = peer.peerConnection.getTransceivers();
            for (const transceiver of transceivers) {
                if (transceiver.receiver.track.kind === 'audio' &&
                    transceiver.sender.track != micTrack
                ) {
                    try {
                        await transceiver.sender.replaceTrack(micTrack);
                    } catch (_) {}
                }
            }
        }
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
            await this.setupTracksAndDataHandlers(peerConnection);
            await this.signalling.hostPost();

            const offer = await peerConnection.createOffer();

            await peerConnection.setLocalDescription(offer);
            this.signalling.localSessionDescription =
                btoa(JSON.stringify(peerConnection.localDescription));
        } else /*if (room.meetingType === webrtcElements.MeetingType.GUEST) */{
        }
    }

    async waitForIceConnected(peerConnection: RTCPeerConnection): Promise<boolean> {
        const stepWait = 200;

        const startTime = Date.now();
        const timeout = (() => {
            if (this.meetingType === signalling.MeetingType.HOST) {
                return 11_000;
            } else {
                return 9_000;
            }
        })();

        while ([
            'new',
            'checking'
        ].indexOf(peerConnection.iceConnectionState) !== -1 &&
        this.interruptMeet === false &&
        Date.now() - startTime < timeout) {
            await this.signalling.polling(peerConnection, this.meetingType!);

            await new Promise(resolve => setTimeout(resolve, stepWait));
        }

        if ([
            'new',
            'checking'
        ].indexOf(peerConnection.iceConnectionState) !== -1) {
            return false;
        } else if ([
            'connected',
            'completed'
        ].indexOf(peerConnection.iceConnectionState) === -1) {
            throw new Error(`iceConnectionState: ${peerConnection.iceConnectionState} when expecting 'connected'`);
        }

        return true;
    }

    async waitForIceClosed(peerConnection: RTCPeerConnection): Promise<void> {
        const stepWait = 200;

        while ([
            'connected',
            'completed',
            'disconnected'
        ].indexOf(peerConnection.iceConnectionState) !== -1 &&
            this.interruptMeet === false) {
            await this.signalling.polling(peerConnection, this.meetingType!);

            await new Promise(resolve => setTimeout(resolve, stepWait));
        }

        if ([
            'connected',
            'completed',
            'disconnected'
        ].indexOf(peerConnection.iceConnectionState) !== -1) {
            return;
        } else if ([
            'failed',
            'closed'
        ].indexOf(peerConnection.iceConnectionState) === -1) {
            throw new Error(`iceConnectionState: ${peerConnection.iceConnectionState} when expecting 'closed'`);
        }
    }
}
