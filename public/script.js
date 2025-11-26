const socket = io();

const loginPage = document.getElementById("loginPage");
const roomPage  = document.getElementById("roomPage");
const callPage  = document.getElementById("callPage");

const loginBtn  = document.getElementById("loginBtn");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const leaveBtn = document.getElementById("leaveBtn");
const sendMsgBtn = document.getElementById("sendMsgBtn");

const userInput = document.getElementById("userInput");
const passInput = document.getElementById("passInput");
const roomInput = document.getElementById("roomInput");
const msgInput  = document.getElementById("msgInput");

const loginError = document.getElementById("loginError");
const userNameLabel = document.getElementById("userNameLabel");
const chatBox = document.getElementById("chatBox");

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

let username = "";
let room = "";
let localStream;
let peer;

// ---------------- LOGIN PAGE ----------------
loginBtn.onclick = () => {
    if (passInput.value !== "gunapvt") {
        loginError.textContent = "Incorrect password";
        return;
    }
    username = userInput.value.trim();
    if (!username) return;

    userNameLabel.textContent = username;
    loginPage.classList.add("hidden");
    roomPage.classList.remove("hidden");
};

// ---------------- ROOM PAGE ----------------
joinRoomBtn.onclick = async () => {
    room = roomInput.value.trim();
    if (!room) return;

    roomPage.classList.add("hidden");
    callPage.classList.remove("hidden");

    await startCall();
    socket.emit("join-room", room);
};

// ---------------- LEAVE ----------------
leaveBtn.onclick = () => {
    if (peer) peer.close();
    if (localStream) localStream.getTracks().forEach(t => t.stop());

    callPage.classList.add("hidden");
    roomPage.classList.remove("hidden");

    socket.emit("leave-room", room);
    chatBox.innerHTML = "";
};

// ---------------- CALL INITIALIZATION ----------------
async function startCall() {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;

    peer = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    localStream.getTracks().forEach(t => peer.addTrack(t, localStream));
    peer.ontrack = e => remoteVideo.srcObject = e.streams[0];
    peer.onicecandidate = e => {
        if (e.candidate) socket.emit("ice", { room, ice: e.candidate });
    };

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    socket.emit("offer", { room, offer });
}

// ---------------- SOCKET LISTENERS ----------------
socket.on("offer", async ({ offer }) => {
    if (!peer) await startCall();
    await peer.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    socket.emit("answer", { room, answer });
});

socket.on("answer", async ({ answer }) => {
    await peer.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on("ice", async ({ ice }) => {
    if (ice) await peer.addIceCandidate(new RTCIceCandidate(ice));
});

// ---------------- CHAT ----------------
sendMsgBtn.onclick = () => {
    const msg = msgInput.value.trim();
    if (!msg) return;
    appendMsg(`You: ${msg}`);
    socket.emit("message", { room, user: username, msg });
    msgInput.value = "";
};

socket.on("message", ({ user, msg }) => {
    appendMsg(`${user}: ${msg}`);
});

function appendMsg(text) {
    const p = document.createElement("p");
    p.textContent = text;
    chatBox.appendChild(p);
    chatBox.scrollTop = chatBox.scrollHeight;
}
