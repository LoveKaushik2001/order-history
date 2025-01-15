const express = require("express");
const { google } = require("googleapis");
require("dotenv").config();
const app = express();
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));

app.get("/", async (req, res) => {
  const customerId = req.query.customerId;
  if (!customerId) {
    return res.status(400).send("Customer Id is required");
  }
  const auth = new google.auth.GoogleAuth({
    credentials: {
      type: "service_account",
      project_id: process.env.GOOGLE_API_PROJECT_ID || "sitesheets",
      project_key_id: process.env.GOOGLE_API_PROJECT_KEY_ID,
      private_key: process.env.GOOGLE_API_PRIVATE_KEY.replace(/\\n/g, "\n"), // Normalize line breaks
      client_email: process.env.GOOGLE_API_CLIENT_EMAIL,
      client_id: process.env.GOOGLE_API_CLIENT_ID,
      auth_uri: process.env.GOOGLE_API_AUTH_URI,
      token_uri: process.env.GOOGLE_API_TOKEN_URI,
      auth_provider_x509_cert_url:
        process.env.GOOGLE_API_AUTH_PROVIDER_X509_CERT_URL,
      client_x509_cert_url: process.env.GOOGLE_API_CLIENT_CERT_URL,
      universe_domain: "googleapis.com",
    },
    scopes: "https://www.googleapis.com/auth/spreadsheets",
  });
  const client = await auth.getClient();
  const googleSheets = google.sheets({ version: "v4", auth: client });
  const spreadsheetId = "1Ejepe2_065wXVUrVulvyv1UMAiLkNq22_MAEzAO11NM";
  const getRows = await googleSheets.spreadsheets.values.get({
    auth,
    spreadsheetId,
    range: "Sheet86",
  });
  const fetchedSheet = getRows.data.values;
  const metaInfo = fetchedSheet.slice(0, 1)[0];
  const datesHead = fetchedSheet.slice(1, 2)[0];
  const heads = fetchedSheet.slice(2, 3)[0];
  const productStartingRow = 4;
  const entries = fetchedSheet.slice(productStartingRow);
  const skusNumber = getSkusNumber(datesHead);
  const skusNameCodes = heads.slice(
    productStartingRow,
    skusNumber + productStartingRow
  );
  const skusDetail = getSkusDetail(metaInfo);
  const customerIndex = entries.findIndex(
    (entry) =>
      entry[0].split(" ").join("").trim() ===
      customerId.split(" ").join("").trim()
  );
  if (customerIndex === -1) {
    return res.status(404).send("Unable to find data against this Customer Id");
  }
  const customerInfo = entries[customerIndex];
  const output = {};
  output["customerId"] = customerInfo[0];
  output["name"] = customerInfo[1];
  output["skusDetail"] = skusDetail;
  output["isSub"] = customerInfo[2];
  output["discount"] = customerInfo[3];
  const dates = {};
  let idx = productStartingRow;
  while (idx < customerInfo.length - 1) {
    const currDayOrders = {};
    skusNameCodes.forEach((code, codeIndex) => {
      currDayOrders[code] = customerInfo[idx + codeIndex];
      // Calculating total products mention here
      if (
        currDayOrders[code].trim()?.length &&
        output["skusDetail"]?.[code]?.length
      ) {
        output["skusDetail"]?.[code]?.length < 4
          ? output["skusDetail"][code].push(parseInt(currDayOrders[code]))
          : (output["skusDetail"][code][3] += parseInt(currDayOrders[code]));
      }
    });
    dates[datesHead[idx]] = currDayOrders;
    idx += skusNumber;
  }
  output["dates"] = dates;
  res.render("index", { output });
  // res.send(output);
});

function getSkusNumber(data) {
  const firstNonEmptyIndex = data.findIndex((item) => item.trim() !== "");
  const secondNonEmptyIndex =
    data.slice(firstNonEmptyIndex + 1).findIndex((item) => item.trim() !== "") +
    (firstNonEmptyIndex + 1);
  return (secondNonEmptyIndex || 0) - (firstNonEmptyIndex || 0);
}

function getSkusDetail(data) {
  const result = {};
  data.forEach((item, index) => {
    const detail = item.split(",");
    result[detail[0].trim()] = [
      detail[1].trim(),
      detail[2].trim(),
      detail?.[3]?.trim() || detail?.[2]?.trim(),
    ];
  });
  return result;
}

app.listen(8080, (req, res) => console.log("running on 8080"));
