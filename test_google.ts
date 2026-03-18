import fs from "fs";

async function run() {
  const apiKey = "AIzaSyAuwSwkfY3TGQnTFRqoiiqTyTqJkyHEjfU";
  const address = "34 Alayande Cl, Mokola, Oyo State, Nigeria";
  const url = `https://addressvalidation.googleapis.com/v1:validateAddress?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      address: {
        addressLines: [address]
      }
    })
  });
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}
run();
