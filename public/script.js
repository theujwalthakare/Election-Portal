// script.js
import { db, ref, push, set } from "./firebase.js";

console.log("✅ script.js loaded");

const voteBtn = document.getElementById("voteBtn");

voteBtn.addEventListener("click", () => {
  const name = document.getElementById("studentName").value.trim();
  const roll = document.getElementById("studentRoll").value.trim();
  const position = document.getElementById("position").value;
  const candidate = document.querySelector('input[name="candidate"]:checked');

  if (!name || !roll || !position || !candidate) {
    alert("⚠️ Please fill all fields and select a candidate!");
    return;
  }

  const voteRef = push(ref(db, "votes/" + position));

  set(voteRef, {
    voter_name: name,
    roll_no: roll,
    candidate: candidate.value,
    timestamp: new Date().toISOString(),
  })
    .then(() => {
      alert("✅ Vote submitted successfully!");
      document.getElementById("voteForm").reset();
    })
    .catch((err) => {
      console.error("Error:", err);
      alert("❌ Error submitting vote!");
    });
});
