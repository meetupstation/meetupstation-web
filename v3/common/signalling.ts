export enum MeetingType {
    HOST,
    GUEST
};

export class SignallingScope {
    id: string = '';
    accessKey: string = '';
    server: string;

    complete: boolean = false;
    localSessionDescription: string = '';
    localCandidates: string[] = [];
    remoteSessionDescription: string = '';
    remoteCandidates: string[] = [];

    constructor(hostId: string, server: string) {
        this.id = hostId;
        this.accessKey = '';
        this.server = server;
    }

    restart() {
        this.complete = false;
        this.localSessionDescription = '';
        this.localCandidates = [];
        this.remoteSessionDescription = '';
        this.remoteCandidates = [];
    }

    location(suffix: string): string {
        return (this.server ? this.server + '/' : '') + suffix;
    }

    async hostPost(): Promise<void> {
        const hostSignal = await fetch(
            this.location('api/host'),
            {
                method: 'POST',
                body: JSON.stringify({
                    id: this.id,
                    description: this.localSessionDescription,
                    candidates: this.localCandidates,
                    accessKey: this.accessKey
                }),
                headers: {
                    'Content-type': 'application/json; charset=UTF-8'
                }
            }
        );

        if (!hostSignal.ok) {
            throw new Error('posting host signal: host is already in a call');
        }

        const hostSignalJson = await hostSignal.json();

        this.id = hostSignalJson.id;
        this.accessKey = hostSignalJson.accessKey;
    }

    async hostGet(): Promise<void> {
        if (this.remoteSessionDescription || this.remoteCandidates.length) {
            return;
        }

        const hostSignal =
            await fetch(
                this.location(`api/host?id=${this.id}&accessKey=${this.accessKey}`),
                {
                    method: 'GET'
                }
            );
        if (!hostSignal.ok) {
            this.complete = true;
            throw new Error('getting host signal: host not found or is already in a call');
        }

        const hostSignalJson = await hostSignal.json();

        this.remoteSessionDescription = hostSignalJson.description;
        this.remoteCandidates = hostSignalJson.candidates;
        this.accessKey = hostSignalJson.accessKey;
    }

    async guestPost(): Promise<void> {
        const guestSignal = await fetch(
            this.location('api/guest'),
            {
                method: 'POST',
                body: JSON.stringify({
                    hostId: this.id,
                    description: this.localSessionDescription,
                    candidates: this.localCandidates,
                    accessKey: this.accessKey
                }),
                headers: {
                    'Content-type': 'application/json; charset=UTF-8'
                }
            }
        );

        if (!guestSignal.ok) {
            this.complete = true;
            throw new Error('posting guest signal: host not found or is already in a call');
        }

        //const guestSignalJson =
        await guestSignal.json();

        this.complete = true;
    }

    async guestGet(): Promise<void> {
        if (this.remoteSessionDescription || this.remoteCandidates.length) {
            return;
        }

        const guestSignal =
            await fetch(
                this.location(`api/guest?hostId=${this.id}&accessKey=${this.accessKey}`),
                {
                    method: 'GET'
                }
            );
        if (!guestSignal.ok) {
            throw new Error('getting guest signal: host not found or is already in a call');
        }

        const guestSignalJson = await guestSignal.json();

        this.remoteSessionDescription = guestSignalJson.description;
        this.remoteCandidates = guestSignalJson.candidates;
    }

    async polling(peerConnection: RTCPeerConnection,
        meetingType: MeetingType) {

        if (this.complete) {
            return;
        }

        if (meetingType === MeetingType.HOST) {
            return await this.hostPolling(peerConnection);
        } else {
            return await this.guestPolling(peerConnection);
        }
    }

    async guestPolling(peerConnection: RTCPeerConnection): Promise<void> {
        if (this.complete) {
            return;
        }

        try {
            await this.hostGet();
        } catch (error) {
            if (this.complete) {
                this.complete = false;
                return;
            } else {
                throw error;
            }
        }

        if (this.remoteSessionDescription) {
            // prepareDataChannel(room, peerConnection);

            await peerConnection.setRemoteDescription(
                JSON.parse(atob(this.remoteSessionDescription))
            );

            const answerDescription = await peerConnection.createAnswer();
            peerConnection.setLocalDescription(answerDescription);
        } else if (this.remoteCandidates.length) {
            // for (const candidate of room.remoteCandidates) {
            //     await peerConnection.addIceCandidate(
            //         JSON.parse(atob(candidate))
            //     );
            // }
        }
        this.remoteSessionDescription = '';
        this.remoteCandidates = [];

        if (this.localSessionDescription || this.localCandidates.length) {
            await this.guestPost();
            this.localSessionDescription = '';
            this.localCandidates = [];
        }
    }

    async hostPolling(peerConnection: RTCPeerConnection): Promise<void> {
        if (this.complete) {
            return;
        }

        if (this.localSessionDescription || this.localCandidates.length) {
            await this.hostPost();
            this.localSessionDescription = '';
            this.localCandidates = [];
        }

        await this.guestGet();

        if (this.remoteSessionDescription) {
            await peerConnection.setRemoteDescription(
                JSON.parse(atob(this.remoteSessionDescription))
            );
            this.complete = true;
        } else if (this.remoteCandidates.length) {
            // for (const candidate of room.remoteCandidates) {
            //     await peerConnection.addIceCandidate(
            //         JSON.parse(atob(candidate))
            //     );
            // }
        }
        this.remoteSessionDescription = '';
        this.remoteCandidates = [];
    }
}
