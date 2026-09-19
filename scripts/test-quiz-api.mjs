async function main() {
  // 1. Login
  const loginRes = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "nikhilamadem9@gmail.com",
      password: "password123",
    }),
  });

  const cookie = loginRes.headers.get("set-cookie");
  console.log("Login status:", loginRes.status);

  // 2. Query quiz topics for IBL
  const projectId = "3f719e4e-2547-493a-953d-23537ec140ba";
  const materialId = "78914ec5-c6cc-4e01-b1ec-5a1b13b718cb";
  const quizRes = await fetch(
    `http://localhost:3000/api/projects/${projectId}/quiz?materialId=${materialId}`,
    {
      headers: { Cookie: cookie || "" },
    }
  );

  console.log("Quiz topics HTTP status:", quizRes.status);
  const data = await quizRes.json();
  console.log("Returned concepts count:", data.concepts?.length);
  if (data.concepts) {
    for (const c of data.concepts) {
      console.log(` - ${c.name}`);
    }
  } else {
    console.log("Response:", data);
  }
}

main().catch(console.error);
