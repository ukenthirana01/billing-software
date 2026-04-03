// ─── Relyce Book — Native License Validation (C++ Node Addon) ───
// This module performs HMAC-SHA256 license validation in native C++ code,
// making it significantly harder to reverse-engineer compared to JavaScript.
//
// To build: npm install node-addon-api && npx node-gyp rebuild
// This requires Visual Studio Build Tools on Windows.
//
// The compiled .node binary can be loaded from main.js as a fallback
// or primary license validator.
// ────────────────────────────────────────────────────────────────────────

#include <napi.h>
#include <openssl/hmac.h>
#include <openssl/evp.h>
#include <string>
#include <sstream>
#include <iomanip>
#include <ctime>
#include <cmath>

// ═══ SECRET — Must match the secret in main.js and generate-license.js ═══
static const std::string LICENSE_SECRET = "MS-BILLING-SECRET-2026-CHANGE-THIS-TO-YOUR-OWN-RANDOM-STRING";

static std::string hmac_sha256(const std::string& key, const std::string& data) {
    unsigned char hash[EVP_MAX_MD_SIZE];
    unsigned int hashLen;

    HMAC(EVP_sha256(),
         key.c_str(), static_cast<int>(key.length()),
         reinterpret_cast<const unsigned char*>(data.c_str()),
         data.length(),
         hash, &hashLen);

    std::stringstream ss;
    for (unsigned int i = 0; i < hashLen; i++) {
        ss << std::hex << std::setfill('0') << std::setw(2) << (int)hash[i];
    }
    return ss.str();
}

// validateLicense(licenseKey: string, hwid: string) -> { valid, expired, reason, daysLeft }
Napi::Object ValidateLicense(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    Napi::Object result = Napi::Object::New(env);

    if (info.Length() < 2 || !info[0].IsString() || !info[1].IsString()) {
        result.Set("valid", Napi::Boolean::New(env, false));
        result.Set("reason", Napi::String::New(env, "Invalid arguments"));
        return result;
    }

    std::string key = info[0].As<Napi::String>().Utf8Value();
    std::string hwid = info[1].As<Napi::String>().Utf8Value();

    // Check prefix
    if (key.substr(0, 4) != "MSB-") {
        result.Set("valid", Napi::Boolean::New(env, false));
        result.Set("reason", Napi::String::New(env, "Invalid format"));
        return result;
    }

    // Extract parts: MSB-YYYYMMDD-signature
    size_t firstDash = key.find('-');
    size_t secondDash = key.find('-', firstDash + 1);
    if (secondDash == std::string::npos) {
        result.Set("valid", Napi::Boolean::New(env, false));
        result.Set("reason", Napi::String::New(env, "Invalid format"));
        return result;
    }

    std::string dateTag = key.substr(firstDash + 1, secondDash - firstDash - 1);
    std::string providedSig = key.substr(secondDash + 1);

    if (dateTag.length() != 8) {
        result.Set("valid", Napi::Boolean::New(env, false));
        result.Set("reason", Napi::String::New(env, "Invalid date in key"));
        return result;
    }

    // Recompute HMAC
    std::string payload = hwid + "|" + dateTag;
    std::string hmac = hmac_sha256(LICENSE_SECRET, payload);
    std::string expectedSig = hmac.substr(0, 12);

    // Constant-time comparison (prevent timing attacks)
    if (providedSig.length() < 12) {
        result.Set("valid", Napi::Boolean::New(env, false));
        result.Set("reason", Napi::String::New(env, "Invalid key for this device"));
        return result;
    }

    int diff = 0;
    for (int i = 0; i < 12; i++) {
        diff |= expectedSig[i] ^ providedSig[i];
    }

    if (diff != 0) {
        result.Set("valid", Napi::Boolean::New(env, false));
        result.Set("reason", Napi::String::New(env, "Invalid key for this device"));
        return result;
    }

    // Check expiry
    int year = std::stoi(dateTag.substr(0, 4));
    int month = std::stoi(dateTag.substr(4, 2));
    int day = std::stoi(dateTag.substr(6, 2));

    std::tm expiry = {};
    expiry.tm_year = year - 1900;
    expiry.tm_mon = month - 1;
    expiry.tm_mday = day;
    expiry.tm_hour = 23;
    expiry.tm_min = 59;
    expiry.tm_sec = 59;

    std::time_t expiryTime = std::mktime(&expiry);
    std::time_t now = std::time(nullptr);

    if (now > expiryTime) {
        result.Set("valid", Napi::Boolean::New(env, false));
        result.Set("expired", Napi::Boolean::New(env, true));
        result.Set("reason", Napi::String::New(env, "License has expired"));
        return result;
    }

    double daysLeft = std::ceil(std::difftime(expiryTime, now) / (60 * 60 * 24));

    result.Set("valid", Napi::Boolean::New(env, true));
    result.Set("daysLeft", Napi::Number::New(env, daysLeft));

    // Format expiry date
    char dateStr[11];
    std::strftime(dateStr, sizeof(dateStr), "%Y-%m-%d", &expiry);
    result.Set("expiryDate", Napi::String::New(env, dateStr));

    return result;
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("validateLicense", Napi::Function::New(env, ValidateLicense));
    return exports;
}

NODE_API_MODULE(license_check, Init)
