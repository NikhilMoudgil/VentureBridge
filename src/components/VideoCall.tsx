import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

export function VideoCall({ roomId, onEndCall }: { roomId: string, onEndCall: () => void }) {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    socketRef.current = io('http://localhost:3001');
    const socket = socketRef.current;

    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      socket.emit('join-room', roomId);
    });

    socket.on('user-connected', async (targetSocketId) => {
      const pc = createPeerConnection(targetSocketId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('offer', { target: targetSocketId, caller: socket.id, sdp: offer });
    });

    socket.on('offer', async (payload) => {
      const pc = createPeerConnection(payload.caller);
      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('answer', { target: payload.caller, caller: socket.id, sdp: answer });
    });

    socket.on('answer', async (payload) => {
      const pc = peerConnectionRef.current;
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
    });

    socket.on('ice-candidate', async (payload) => {
      const pc = peerConnectionRef.current;
      if (pc) await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
    });

    return () => {
      localStreamRef.current?.getTracks().forEach(track => track.stop());
      peerConnectionRef.current?.close();
      socket.disconnect();
    };
  }, [roomId]);

  const createPeerConnection = (targetSocketId: string) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionRef.current = pc;

    localStreamRef.current?.getTracks().forEach(track => {
      pc.addTrack(track, localStreamRef.current!);
    });

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit('ice-candidate', {
          target: targetSocketId,
          candidate: event.candidate
        });
      }
    };

    return pc;
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const track = localStreamRef.current.getAudioTracks()[0];
      track.enabled = !track.enabled;
      setIsMuted(!track.enabled);
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const track = localStreamRef.current.getVideoTracks()[0];
      track.enabled = !track.enabled;
      setIsVideoOff(!track.enabled);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950 p-4">
      <div className="relative flex-1 overflow-hidden rounded-xl bg-zinc-900">
        <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" />
        <div className="absolute bottom-4 right-4 h-48 w-32 overflow-hidden rounded-lg border-2 border-zinc-700 bg-black shadow-lg md:h-64 md:w-48">
          <video ref={localVideoRef} autoPlay playsInline muted className="h-full w-full transform scale-x-[-1] object-cover" />
        </div>
      </div>
      <div className="flex justify-center gap-4 py-6">
        <button onClick={toggleMute} className={`rounded-full p-4 ${isMuted ? 'bg-red-500' : 'bg-zinc-800'}`}>
          {isMuted ? <MicOff className="text-white" /> : <Mic className="text-white" />}
        </button>
        <button onClick={toggleVideo} className={`rounded-full p-4 ${isVideoOff ? 'bg-red-500' : 'bg-zinc-800'}`}>
          {isVideoOff ? <VideoOff className="text-white" /> : <Video className="text-white" />}
        </button>
        <button onClick={onEndCall} className="rounded-full bg-red-600 p-4 hover:bg-red-700">
          <PhoneOff className="text-white" />
        </button>
      </div>
    </div>
  );
}