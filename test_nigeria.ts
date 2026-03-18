import fs from "fs";

async function run() {
  const res = await fetch("https://temikeezy.github.io/nigeria-geojson-data/data/full.json");
  const data = await res.json();
  console.log(JSON.stringify(data[0], null, 2));
}
run();
