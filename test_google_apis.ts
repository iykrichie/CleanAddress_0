import fs from "fs";

async function testApis() {
  const apiKey = "AIzaSyAuwSwkfY3TGQnTFRqoiiqTyTqJkyHEjfU";
  const address = "34 Alayande Cl, Mokola, Oyo State";

  console.log("1. Testing Address Validation API without regionCode...");
  try {
    const res1 = await fetch(`https://addressvalidation.googleapis.com/v1:validateAddress?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: { addressLines: [address] } })
    });
    console.log("Status:", res1.status);
    console.log(await res1.json());
  } catch (e) { console.error(e); }
}

testApis();
