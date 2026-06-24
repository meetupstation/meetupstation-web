export enum MeetingType {
    HOST,
    GUEST
};

export class Room {
    peerConnections: Map<string, RTCPeerConnection> = new Map();
    localSessionDescription: string|null = null;
    dataChannel: RTCDataChannel|null = null;
    breakOnException: boolean = true;
    nextPeerConnectionId: number = 0;
};