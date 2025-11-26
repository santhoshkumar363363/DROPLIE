const socket = io();
let localStream, remoteStream, peer;

const loginScreen = document.getElementById("loginScreen");
const mainScreen = document.getElementById("mainScreen");
const usernameInput = document.getElementById("usernameInput");
const passwordInput = document.getElementById("passwordInput");
const loginBtn = document.getElementById("loginBtn");
const loginError = document.getElementById("loginError");

loginBtn.onclick = () => {
  if (passwordInput.value !== "gunapvt") {
    loginError.style.display = "block";
    return;
  }
  loginScreen.style.display = "none";
  mainScreen.style.display = "block";
};

document.getElementById("joinBtn").onclick = async () => {
  const room = document.getElementById("roomInput").value.trim();
  if (!room) return alert("Enter room ID");

  await startVideo();
  socket.emit("join-room", room);
};

document.getElementById("leaveBtn").onclick = () => {
  location.reload();
};

document.getElementById("sendBtn").onclick = () => {
  const msg = msgInput.value.trim();
  if (!msg) return;
  socket.emit("message", msg);
  addMessage("You", msg);
  msgInput.value = "";
};

socket.on("message", msg => addMessage("Friend", msg));

function addMessage(user, msg) {
  const box = document.getElementById("messages");
  box.innerHTML += `<p><b>${user}:</b> ${msg}</p>`;
  box.scrollTop = box.scrollHeight;
}

async function startVideo() {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  document.getElementById("localVideo").srcObject = localStream;

  peer = new RTCPeerConnection();
  remoteStream = new MediaStream();
  document.getElementById("remoteVideo").srcObject = remoteStream;

  localStream.getTracks().forEach(track => peer.addTrack(track, localStream));
  peer.ontrack = e => e.streams[0].getTracks().forEach(track => remoteStream.addTrack(track));

  peer.onicecandidate = e => e.candidate && socket.emit("ice", e.candidate);

  socket.on("offer", async offer => {
    await peer.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    socket.emit("answer", answer);
  });

  socket.on("answer", ans => peer.setRemoteDescription(new RTCSessionDescription(ans)));
  socket.on("ice", cand => peer.addIceCandidate(new RTCIceCandidate(cand)));

  const offer = await peer.createOffer();
  await peer.setLocalDescription(offer);
  socket.emit("offer", offer);
}
