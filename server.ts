import express from "express";
import multer from "multer";
import Papa from "papaparse";
import stringSimilarity from "string-similarity";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";

const app = express();
const PORT = 3000;

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const upload = multer({ dest: UPLOADS_DIR });

let nigeriaData: any = null;

async function loadNigeriaData() {
  try {
    const response = await fetch("https://temikeezy.github.io/nigeria-geojson-data/data/full.json");
    if (response.ok) {
      nigeriaData = await response.json();
      console.log("Nigerian hierarchy data loaded successfully.");
    } else {
      console.error("Failed to load Nigerian hierarchy data.");
    }
  } catch (error) {
    console.error("Error loading Nigerian hierarchy data:", error);
  }
}

async function fetchWithRetry(url: string, options: any, retries = 3, backoff = 2000): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const response = await fetch(url, options);
    if (response.status === 429) {
      console.warn(`Rate limited (429). Retrying in ${backoff}ms...`);
      await new Promise((resolve) => setTimeout(resolve, backoff));
      backoff *= 2; // Exponential backoff
    } else {
      return response;
    }
  }
  return fetch(url, options); // Final attempt
}

async function processAddressWithGoogle(address: string, apiKey: string) {
  try {
    // Localize to Nigeria using components=country:NG
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&components=country:NG&key=${apiKey}`;
    const response = await fetchWithRetry(url, { method: "GET" });

    if (response.ok) {
      return await response.json();
    } else {
      console.error("Google API Error:", response.status, await response.text());
      return null;
    }
  } catch (error) {
    console.error("Google API Exception:", error);
    return null;
  }
}

function fuzzyMatchLGA(address: string) {
  if (!nigeriaData) return null;

  let allLgas: { name: string, state: string }[] = [];
  for (const state of nigeriaData) {
    if (state.lgas) {
      for (const lga of state.lgas) {
        allLgas.push({ name: lga.name, state: state.state });
      }
    }
  }

  if (allLgas.length === 0) return null;

  const lowerAddress = address.toLowerCase();
  const lgaNames = allLgas.map(l => l.name);

  // First check for exact substring match
  for (const lga of allLgas) {
    if (lowerAddress.includes(lga.name.toLowerCase())) {
      return lga;
    }
  }

  // Then try fuzzy matching on individual words or pairs
  const words = address.split(/[\s,]+/);
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (word.length >= 3) {
      const match = stringSimilarity.findBestMatch(word, lgaNames);
      if (match.bestMatch.rating > 0.8) {
        return allLgas[match.bestMatchIndex];
      }
    }
    
    // Check pairs of words (e.g., "Eti Osa")
    if (i < words.length - 1) {
      const pair = `${words[i]} ${words[i+1]}`;
      const matchPair = stringSimilarity.findBestMatch(pair, lgaNames);
      if (matchPair.bestMatch.rating > 0.8) {
        return allLgas[matchPair.bestMatchIndex];
      }
    }
  }

  return null;
}

app.post("/api/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const apiKey = process.env.GOOGLE_API_KEY || "AIzaSyAuwSwkfY3TGQnTFRqoiiqTyTqJkyHEjfU";
  if (!apiKey) {
    return res.status(500).json({ error: "GOOGLE_API_KEY is not configured" });
  }

  try {
    const data: any[] = await new Promise((resolve, reject) => {
      const fileStream = fs.createReadStream(req.file!.path);
      Papa.parse(fileStream, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          resolve(results.data);
        },
        error: (err) => {
          reject(err);
        }
      });
    });

    if (!data || data.length === 0) {
      throw new Error("The uploaded file is empty or invalid.");
    }

    const results = [];

    let index = 0;
    for (const row of data) {
      let rawAddress = row.address || row.Address || Object.values(row)[0];
      if (!rawAddress) continue;
      
      const originalAddress = String(rawAddress).trim();
      if (!originalAddress) continue;

      // New variables as per user request
      let houseNo = "";
      let poBox = "";
      let streetOrHouseName = "";
      let lga = "";
      let state = "";
      let country = "NIGERIA"; // Defaulting to Nigeria

      let standardizedAddress = "";
      let correctionsMade = [];

      // 1. Google Geocoding API Call
      const googleResult = await processAddressWithGoogle(originalAddress, apiKey);
      
      if (googleResult && googleResult.results && googleResult.results.length > 0) {
        const result = googleResult.results[0];
        
        if (result.address_components) {
          for (const component of result.address_components) {
            const types = component.types;
            if (types.includes("street_number")) houseNo = component.long_name;
            if (types.includes("post_box")) poBox = component.long_name;
            if (types.includes("route")) streetOrHouseName = component.long_name;
            // Google often puts LGA in administrative_area_level_2 or locality
            if (types.includes("administrative_area_level_2")) lga = component.long_name;
            if (types.includes("locality") && !lga) lga = component.long_name;
            if (types.includes("administrative_area_level_1")) state = component.long_name;
            if (types.includes("country")) country = component.long_name.toUpperCase();
          }
          correctionsMade.push("Address components extracted via Google API");
        }
      }

      // 2. Fallback Parsing and Fuzzy Matching
      // Extract P.O. Box / PMB
      const poBoxMatch = originalAddress.match(/(?:P\.?\s*O\.?\s*Box|POBox|P\.?\s*M\.?\s*B\.?)\s*(\d+)/i);
      if (poBoxMatch) {
        poBox = `P.O. BOX ${poBoxMatch[1]}`;
        // If Google mistook the PO box number for a house number, clear it
        if (houseNo === poBoxMatch[1]) {
          houseNo = "";
        }
      }
      
      let addressForParsing = originalAddress;
      if (poBoxMatch) {
        addressForParsing = addressForParsing.replace(poBoxMatch[0], "");
      }

      // Fallback for House Number
      if (!houseNo && !poBox) {
        const hnMatch = addressForParsing.match(/(?:No\.?\s*|Plot\s+|Block\s+|Flat\s+)?(\d+[A-Za-z]?)(?:\s*,|\s+)/i) || addressForParsing.match(/^(\d+[A-Za-z]?)\s*,?\s+/);
        if (hnMatch) {
          houseNo = hnMatch[1];
          correctionsMade.push("House Number extracted via fallback");
        }
      }

      // Fallback for Street Name
      if (!streetOrHouseName) {
        const stMatch = addressForParsing.match(/([^,]+?\s+(?:Street|St|Road|Rd|Avenue|Ave|Close|Cl|Crescent|Way|Drive|Lane|Highway|Expressway|Bypass|Layout|Estate|Quarters|Qtrs))/i);
        if (stMatch) {
          let st = stMatch[1].trim();
          // Remove house number from the start of the street name
          st = st.replace(/^(?:No\.?\s*|Plot\s+|Block\s+|Flat\s+)?\d+[A-Za-z]?\s*,?\s*/i, '');
          streetOrHouseName = st;
          correctionsMade.push("Street/House Name extracted via fallback");
        }
      }

      // Fuzzy LGA Matching
      if (!lga) {
        const matchedLga = fuzzyMatchLGA(originalAddress);
        if (matchedLga) {
          lga = matchedLga.name;
          if (!state) {
            state = matchedLga.state;
          }
          correctionsMade.push(`LGA and State extracted via fuzzy match`);
        }
      }
      
      // 3. Construct the Standardized Address and Final Output
      // Format components to UPPER CASE
      houseNo = houseNo.toUpperCase();
      poBox = poBox.toUpperCase();
      streetOrHouseName = streetOrHouseName.toUpperCase();
      lga = lga.toUpperCase();
      state = state.toUpperCase();

      const addressParts = [];
      if (poBox) {
        addressParts.push(poBox);
      } else if (houseNo) {
        addressParts.push(houseNo);
      }
      if (streetOrHouseName) addressParts.push(streetOrHouseName);
      if (lga) addressParts.push(lga);
      if (state) addressParts.push(state);
      if (country) addressParts.push(country);
      
      standardizedAddress = addressParts.join(", ");

      results.push({
        "S/N": index + 1,
        "Address": originalAddress,
        "House No": poBox ? "" : houseNo, // Per user, only one should be filled
        "P.O. Box": poBox,
        "street or house name": streetOrHouseName,
        "LGA": lga,
        "STATE": state,
        "country": country,
        "standardized address": standardizedAddress,
      });

      // Simple rate limiting
      await new Promise((resolve) => setTimeout(resolve, 20));
      index++;
    }

    // Clean up uploaded file
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    // Return JSON for preview
    return res.json({ results });

  } catch (error: any) {
    console.error("Processing error:", error);
    res.status(500).json({ error: error.message || "Failed to process file" });
  }
});

async function startServer() {
  await loadNigeriaData();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
