export enum MeetingType {
    HOST,
    GUEST
};

export class Room {
    id: number;
    meetingType: MeetingType|null = null;
    signalId: string = '';
    signalAccessKey: string = '';
    rooms: Map<string, Room>;
    peerConnections: Map<string, RTCPeerConnection> = new Map();
    localSessionDescription: string = '';
    localCandidates: string[] = [];
    remoteSessionDescription: string = '';
    remoteCandidates: string[] = [];
    dataChannel: RTCDataChannel|null = null;
    nextPeerConnectionId: number = 0;

    constructor(id: number, rooms: Map<string, Room>) {
        this.id = id;
        this.rooms = rooms;
    }
};

export class ControlledError extends Error {
    constructor(message: string) {
        super(message);
    }
};
