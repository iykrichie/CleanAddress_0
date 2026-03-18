# CleanAddress

**CleanAddress** is a robust, full-stack web application designed to bulk-process, parse, standardize, and geocode raw Nigerian addresses. It takes messy, unstructured address data from CSV files, cleans it up using the Google Geocoding API alongside custom Nigerian-specific fallback logic, and outputs a neatly formatted, highly accurate CSV file.

Built with a focus on performance, accuracy, and user experience, CleanAddress handles the nuances of Nigerian addressing systems (like PO Boxes, Plots, Blocks, and Estates) that standard geocoders often miss.

---

## 🌟 Key Features

- **Bulk Processing**: Upload CSV files containing thousands of addresses. The system processes them concurrently while respecting API rate limits.
- **Intelligent Parsing & Extraction**: Extracts specific components into distinct columns:
  - PO Box
  - House Number
  - Street Name
  - Local Area (LGA/Neighborhood)
  - City
  - State
  - Postal Code
- **Nigerian-Specific Fallbacks**:
  - **PO Box Regex**: Custom logic to catch Nigerian PO Box formats (e.g., `P.M.B`, `P.O. Box`, `POBox`) and prevent them from being falsely identified as house numbers.
  - **Street Pattern Regex**: Custom logic for Nigerian street patterns (e.g., `Plot`, `Block`, `Crescent`, `Expressway`, `Layout`, `Estate`).
  - **Fuzzy Matching**: Matches missing Local Areas or States against a comprehensive, hardcoded database of all 774 Nigerian Local Government Areas (LGAs) to correct misspellings and fill in gaps.
- **Strict Formatting**: All output is formatted in `UPPER CASE`. The final standardized address is cleanly concatenated in a readable format: `[PO Box], [House Number] [Street Name], [Local Area], [City], [State] [Postal Code], NIGERIA`.
- **Geocoding**: Retrieves Latitude and Longitude for mapping and spatial analysis.
- **Interactive UI**: Features a drag-and-drop interface, pre-processing address count, real-time processing state, a results preview table, and one-click CSV download.
- **Rate Limiting & Error Handling**: Built-in 50 QPS (Queries Per Second) rate limiting to respect Google API quotas, alongside graceful error handling for timeouts and malformed files.

---

## 🛠️ Tech Stack & Architecture

### Frontend
- **React 18**: Component-based UI.
- **Vite**: Ultra-fast build tool and development server.
- **Tailwind CSS**: Utility-first CSS framework for styling.
- **Lucide React**: Beautiful, consistent icons.
- **papaparse**: For parsing uploaded CSV files and generating the final downloadable CSV report.

### Backend
- **Node.js & Express**: Fast, unopinionated web framework for handling API requests.
- **Multer**: Middleware for handling `multipart/form-data` (file uploads).
- **String-Similarity**: Implements the Sørensen–Dice coefficient for fuzzy matching LGAs and States.
- **P-Limit**: Manages concurrency to ensure we don't overwhelm external APIs.

### External APIs
- **Google Maps Geocoding API**: The primary engine for standardizing addresses and retrieving coordinates.

---

## 📂 Project Structure

```text
cleanaddress/
├── src/
│   ├── App.tsx           # Main React component (UI, file handling, preview)
│   ├── main.tsx          # React entry point
│   └── index.css         # Tailwind CSS imports
├── server.ts             # Express backend (API routes, processing logic, fuzzy matching)
├── index.html            # HTML template
├── package.json          # Project dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── vite.config.ts        # Vite configuration
└── README.md             # Project documentation
```

---

## 🚀 Local Development Setup

### Prerequisites
- **Node.js**: v18 or higher.
- **npm** or **yarn**.
- **Google Cloud Platform Account**: You must have a project with the **Geocoding API** enabled and a valid API key with billing attached.

### 1. Clone the repository
```bash
git clone <repository-url>
cd cleanaddress
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Variables
Create a `.env` file in the root directory and add your Google Maps API Key:
```env
# .env
GOOGLE_API_KEY=your_google_maps_api_key_here
```

### 4. Start the Development Server
```bash
npm run dev
```
The application will start concurrently. The Express server will run on port `3000`, and Vite will serve the frontend. Open your browser and navigate to `http://localhost:3000`.

---

## 🧪 How to Test

### 1. Prepare Test Data
Create a `.csv` file. Ensure it has a column named `Address` or `address`.
*Sample Data:*
```csv
Address
Plot 12 Awolowo road, Ikoyi Lagos
P.O. Box 456, Wuse Zone 5, Abuja
Block 4, Ademola Adetokunbo crescent, wuse 2
No 15, independence layout, enugu
```

### 2. Upload and Process
1. Open the app in your browser.
2. Drag and drop your test file into the upload area.
3. The app will parse the file locally and display the number of valid addresses found.
4. Click **Begin Processing**.

### 3. Verify the Output
Once finished, check the Results Preview table. Verify the following:
- **PO Boxes** are extracted correctly into their own column.
- **House Numbers** and **Street Names** are split accurately.
- All text is formatted in **UPPER CASE**.
- The **Standardized Address** is cleanly concatenated (e.g., `PLOT 12 AWOLOWO ROAD, IKOYI, LAGOS, NIGERIA`).
- **Latitude** and **Longitude** are populated.

### 4. Download
Click **Download CSV** to export the final, processed dataset.

---

## 🧠 Data Processing Pipeline (Deep Dive)

For every address uploaded, the backend performs the following sequential pipeline:

1. **Google Geocoding**: 
   Queries the Google Geocoding API. We append `components=country:NG` to strictly localize results to Nigeria.
2. **Component Extraction**: 
   Maps Google's `address_components` (route, locality, administrative_area_level_1, etc.) to our specific columns (Street Name, City, State, etc.).
3. **PO Box Extraction (Custom)**: 
   Uses Regex to safely extract PO Boxes. It removes the PO Box from the raw string to prevent it from being falsely identified as a House Number in subsequent steps.
4. **Fallback Regex (Custom)**: 
   If Google fails to find a House Number or Street Name, custom Regex scans the raw address for Nigerian patterns (Plot, Block, Crescent, etc.).
5. **Fuzzy LGA Matching (Custom)**: 
   If the Local Area or State is still missing, the raw address is fuzzy-matched against a static JSON database of all 774 Nigerian LGAs. If a match > 60% confidence is found, the State and LGA are populated.
6. **Reconstruction & Formatting**: 
   The final `Standardized Address` is rebuilt from scratch using the cleaned components to guarantee a uniform, readable format. All strings are converted to UPPER CASE.

---

## 🌍 Production Deployment

This application is designed as a Full-Stack Express + Vite app. The production build compiles the React frontend into static files, which are then served by the Express backend.

### 1. Build the Application
```bash
npm run build
```
This command compiles the TypeScript code and builds the Vite frontend into the `dist/` directory.

### 2. Start the Production Server
```bash
NODE_ENV=production npm start
```
*(Ensure your `package.json` has a `start` script configured, e.g., `"start": "node server.js"` or `"start": "tsx server.ts"`).*

### Deployment Options

#### Option A: Docker (Recommended)
Docker ensures the app runs consistently across any environment.

Create a `Dockerfile` in the root directory:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

Build and run the container:
```bash
docker build -t cleanaddress .
docker run -p 3000:3000 -e GOOGLE_API_KEY=your_google_api_key -e NODE_ENV=production cleanaddress
```

#### Option B: Google Cloud Run
1. Ensure you have a `Dockerfile` (as shown above).
2. Install the Google Cloud CLI.
3. Run the following command to build and deploy:
```bash
gcloud run deploy cleanaddress --source . --port 3000 --set-env-vars GOOGLE_API_KEY=your_google_api_key,NODE_ENV=production --allow-unauthenticated
```

#### Option C: Render / Heroku
1. Connect your GitHub repository to the platform.
2. Set the **Build Command** to: `npm install && npm run build`
3. Set the **Start Command** to: `npm start`
4. Add `GOOGLE_API_KEY` and `NODE_ENV=production` to the platform's Environment Variables settings.

---

## 🔒 Security & Privacy Notes

- **File Cleanup**: Uploaded files are temporarily stored in the `/uploads` directory using Multer. They are immediately deleted (`fs.unlinkSync`) after the data is extracted into memory, ensuring no user data is left on the server.
- **API Key Security**: The Google API key is kept securely on the backend (`server.ts`). It is never exposed to the client-side browser, preventing unauthorized usage.
- **CORS & Rate Limiting**: The Express server can be configured with CORS to only accept requests from specific domains, and the internal processing queue prevents API abuse.

---

## 📝 License

MIT License. Feel free to modify and use for your own projects.

---

**Built by Coronation Technology**
