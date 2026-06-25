export enum MeetingType {
    HOST,
    GUEST
};

export class Room {
    id: number;
    rooms: Map<string, Room>;
    peerConnections: Map<string, RTCPeerConnection> = new Map();
    localSessionDescription: string|null = null;
    dataChannel: RTCDataChannel|null = null;
    nextPeerConnectionId: number = 0;

    constructor(id: number, rooms: Map<string, Room>) {
        this.id = id;
        this.rooms = rooms;
    }
};
