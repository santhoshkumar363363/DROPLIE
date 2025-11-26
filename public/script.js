const socket = io();
const url = new URL(location.href);
const room = url.searchParams.get("room");
const username = localStorage.getItem("username");

socket.emit("join-room", room, username);

const pc = new RTCPeerConnection({ iceServers:[{ urls:"stun:stun.l.google.com:19302" }]});
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const chatBox = document.getElementById("chatBox");

navigator.mediaDevices.getUserMedia({ video:true, audio:true }).then(stream => {
  stream.getTracks().forEach(t => pc.addTrack(t, stream));
  localVideo.srcObject = stream;
});

pc.ontrack = e => remoteVideo.srcObject = e.streams[0];
pc.onicecandidate = e => e.candidate && socket.emit("ice", e.candidate);

socket.on("offer", async sdp => { await pc.setRemoteDescription(sdp); const ans = await pc.createAnswer(); await pc.setLocalDescription(ans); socket.emit("answer", ans); });
socket.on("answer", sdp => pc.setRemoteDescription(sdp));
socket.on("ice", c => pc.addIceCandidate(c));

async function call() {
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit("offer", offer);
}
setTimeout(call, 1000);

document.getElementById("sendBtn").onclick = () => {
  const msg = `${username}: ${messageInput.value}`;
  socket.emit("message", msg);
  messageInput.value = "";
};
socket.on("message", msg => chatBox.innerHTML += `<p>${msg}</p>`);

document.getElementById("leaveBtn").onclick = () => location.href = "room.html";
document.getElementById("skipBtn").onclick = () => location.href = "room.html";
