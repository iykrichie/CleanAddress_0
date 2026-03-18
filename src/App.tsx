/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Upload, FileDown, Loader2, MapPin, Eye, RotateCcw } from "lucide-react";
import Papa from "papaparse";

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [previewData, setPreviewData] = useState<any[] | null>(null);
  const [addressCount, setAddressCount] = useState<number>(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setError("");
      setPreviewData(null);
      setAddressCount(0);

      Papa.parse(selectedFile, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const data = results.data as any[];
          let count = 0;
          for (const row of data) {
            const rawAddress = row.address || row.Address || Object.values(row)[0];
            if (rawAddress && String(rawAddress).trim()) {
              count++;
            }
          }
          setAddressCount(count);
        },
        error: (err: any) => {
          console.error("PapaParse Error:", err);
          setError("Failed to parse CSV file. Please check the format.");
        }
      });
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreviewData(null);
    setAddressCount(0);
    setError("");
    const fileInput = document.getElementById("file-upload") as HTMLInputElement;
    if (fileInput) fileInput.value = "";
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file first.");
      return;
    }

    setLoading(true);
    setError("");
    setPreviewData(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Upload failed");
        }
        setPreviewData(data.results);
      } else {
        const text = await response.text();
        console.error("Non-JSON response:", text.substring(0, 200));
        if (response.status === 504 || response.status === 502) {
          throw new Error("The server took too long to respond. Try uploading a smaller file with fewer addresses.");
        }
        throw new Error(`Server returned an unexpected response (${response.status}). Please try again.`);
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during processing.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!previewData || previewData.length === 0) return;

    try {
      const csv = Papa.unparse(previewData);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `validated_addresses_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to generate and download CSV file.", err);
      setError("An error occurred while creating the CSV file.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <MapPin className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">
            CleanAddress
          </h1>
          <p className="mt-4 text-lg text-gray-600">
            Upload your raw Nigerian addresses (CSV) and get standardized addresses, parsed components, and coordinates.
          </p>
        </div>

        <div className="bg-white shadow-xl rounded-2xl p-8 border border-gray-100">
          <div className="space-y-6">
            {!previewData && !loading && addressCount === 0 && (
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-green-500 transition-colors bg-gray-50">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer flex flex-col items-center justify-center space-y-3"
                >
                  <Upload className="h-10 w-10 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">
                    Click to upload CSV file
                  </span>
                  <span className="text-xs text-gray-500">
                    Must contain an "address" column
                  </span>
                </label>
              </div>
            )}

            {!previewData && !loading && addressCount > 0 && (
              <div className="text-center p-8 bg-green-50 rounded-xl border border-green-200">
                <h3 className="text-3xl font-bold text-green-800 mb-2">{addressCount}</h3>
                <p className="text-green-600 font-medium mb-6">Addresses found and ready for processing</p>
                <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 justify-center">
                  <button
                    onClick={handleReset}
                    className="flex items-center justify-center py-3 px-6 border border-gray-300 rounded-xl shadow-sm text-base font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpload}
                    className="flex items-center justify-center py-3 px-6 border border-transparent rounded-xl shadow-sm text-base font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all"
                  >
                    Begin Processing
                  </button>
                </div>
              </div>
            )}

            {loading && (
              <div className="text-center p-12 bg-gray-50 rounded-xl border border-gray-200 flex flex-col items-center justify-center">
                <Loader2 className="animate-spin h-12 w-12 text-green-600 mb-4" />
                <h3 className="text-xl font-medium text-gray-900">Processing Addresses...</h3>
                <p className="text-gray-500 mt-2">This may take a moment depending on the file size.</p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm font-medium">
                {error}
              </div>
            )}
          </div>
        </div>

        {previewData && (
          <div className="bg-white shadow-xl rounded-2xl p-8 border border-gray-100 overflow-hidden">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 space-y-4 sm:space-y-0">
              <h2 className="text-2xl font-bold text-gray-900">Results Preview</h2>
              <div className="flex space-x-3">
                <button
                  onClick={handleReset}
                  className="flex items-center justify-center py-2 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all"
                >
                  <RotateCcw className="-ml-1 mr-2 h-4 w-4 text-gray-500" />
                  Start Over
                </button>
                <button
                  onClick={handleDownload}
                  className="flex items-center justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all"
                >
                  <FileDown className="-ml-1 mr-2 h-4 w-4 text-white" />
                  Download CSV
                </button>
              </div>
            </div>
            
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {Object.keys(previewData[0]).map((key) => (
                      <th
                        key={key}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                      >
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {previewData.slice(0, 5).map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      {Object.values(row).map((val: any, j) => (
                        <td key={j} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {val || "-"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {previewData.length > 5 && (
              <p className="text-sm text-gray-500 mt-4 text-center">
                Showing first 5 of {previewData.length} results. Download the CSV file to see all.
              </p>
            )}
          </div>
        )}

        <div className="bg-blue-50 rounded-xl p-6 border border-blue-100">
          <h3 className="text-sm font-semibold text-blue-800 uppercase tracking-wider mb-2">
            How it works
          </h3>
          <ul className="text-sm text-blue-700 space-y-2 list-disc list-inside">
            <li>Ensure your CSV file has a column named <strong>"address"</strong>.</li>
            <li>We process each address using the Google Geocoding API, localized to Nigeria.</li>
            <li>We apply fuzzy matching against Nigerian States and LGAs to fix typos and enhance results.</li>
            <li>You can preview the results before downloading the final CSV file.</li>
          </ul>
        </div>

        <footer className="text-center py-6 text-sm text-gray-500">
          Built by Coronation Technology
        </footer>
      </div>
    </div>
  );
}
