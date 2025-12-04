# Privacy-Preserving Personal Allergen Tracker

A mobile-first health application that empowers users to track their dietary intake and allergic reactions securely. Users record encrypted meal logs and symptoms, and the app leverages Full Homomorphic Encryption (FHE) to detect potential allergens without exposing any personal data.

## Project Overview

Food allergies affect millions of people, but current tracking solutions often compromise user privacy or rely on manual logging with limited insight:

* **Sensitive Data Exposure**: Diet and health logs reveal intimate lifestyle details.
* **Limited Analysis**: Most apps perform analysis on raw data, requiring trust in central servers.
* **False Negatives or Missed Alerts**: Users may overlook correlations due to manual or partial tracking.

Our solution uses FHE to compute on encrypted data, enabling pattern detection and allergen prediction without ever decrypting the underlying logs. This ensures that sensitive dietary and health information remains fully private while still providing actionable insights.

## Key Features

### Core Functionality

* **Encrypted Meal & Symptom Logging**: Record foods eaten and allergic reactions securely on-device.
* **Allergen Correlation Analysis**: Identify potential allergens through FHE-powered correlation computation.
* **Predictive Alerts**: Receive warnings about likely allergens before consuming risk foods.
* **Customizable Triggers**: Users can adjust thresholds for alert notifications.
* **Historical Trends**: Track reactions over time without exposing personal data.

### Privacy & Security

* **Full Homomorphic Encryption (FHE)**: Enables analytics on encrypted logs directly, preventing server-side exposure.
* **End-to-End Encryption**: Data encrypted at creation; only the user can access raw logs.
* **Local Processing First**: Minimal sensitive data ever leaves the device, even during analysis.
* **Secure Integration with External APIs**: Restaurant menus or ingredient databases can be queried without revealing user-specific logs.

## Architecture

### Mobile Application

* **iOS (Swift) & Android (Kotlin)**: Native, performant apps for both platforms.
* **Encrypted Local Storage**: Stores all logs encrypted with user keys.
* **FHE Engine Integration**: Performs encrypted computation for correlation analysis.
* **Notification System**: Push alerts for potential allergens without exposing any raw data.

### Data Flow

1. User logs a meal and symptoms.
2. Data is encrypted on-device using FHE-compatible keys.
3. Encrypted logs are stored locally or optionally synced to the cloud.
4. FHE computations identify patterns and correlations between foods and symptoms.
5. Alerts or statistical insights are generated without ever decrypting the data on a server.

### Optional Cloud Services

* Securely store encrypted logs to enable cross-device access.
* Perform large-scale correlation analysis in encrypted form.
* No server ever sees decrypted logs; FHE ensures privacy throughout.

## Technology Stack

### Backend / FHE Layer

* **Concrete FHE SDK**: Homomorphic encryption engine for encrypted computations.
* **Rust / Kotlin / Swift Bindings**: Integrate FHE routines directly into mobile apps.
* **Encrypted Data Synchronization**: Optional cloud storage for encrypted logs.

### Mobile Frontend

* **Swift (iOS)** & **Kotlin (Android)**: Native apps for smooth UX.
* **Local Encryption Storage**: Securely store user logs on-device.
* **Real-time Analysis**: FHE computations produce alerts without sending raw data externally.
* **Modern UI Components**: Dashboards for dietary trends, reactions, and potential allergens.

## Installation

### Prerequisites

* iOS 15+ or Android 12+
* Swift or Kotlin compatible development environment for compilation
* Device storage with encryption enabled

### Setup

1. Clone the project repository to your development environment.
2. Integrate FHE SDK according to platform-specific instructions.
3. Build the app for simulator or physical device.
4. Initialize user keys and secure storage before logging data.

## Usage

* **Log Meals & Reactions**: Input dietary intake and any allergy symptoms immediately after eating.
* **Monitor Trends**: View correlation statistics and trends in your encrypted dashboard.
* **Receive Alerts**: Real-time notifications when potential allergens are detected.
* **Export Encrypted Reports**: Share encrypted logs with healthcare providers without revealing raw data.

## Security Features

* **Client-Side Encryption**: All logs are encrypted before leaving the device.
* **FHE-Powered Analytics**: Analysis happens on encrypted data; servers never see plaintext.
* **Zero-Knowledge Storage**: Even cloud backups cannot access raw meal logs.
* **Tamper-Resistant Logs**: Encrypted logs are immutable once saved.

## Roadmap

* **Enhanced Allergen Prediction Models**: Improve accuracy of correlation detection via FHE computation.
* **Multi-User Family Tracking**: Allow encrypted logs for multiple users while maintaining privacy.
* **Integration with Wearables**: Include biometric or heart-rate data in FHE analysis for improved prediction.
* **Offline-First Functionality**: Fully functional offline logging and FHE processing.
* **Advanced Notifications**: AI-driven alert customization based on historical trends.

## Why FHE Matters

Full Homomorphic Encryption allows computations on encrypted user data without ever decrypting it. In this application:

* Users gain personalized insights without exposing sensitive health and dietary information.
* Restaurants, healthcare providers, or cloud services never access raw logs, preserving trust.
* Enables complex analytics (correlation, trend detection) on encrypted datasets, bridging privacy with usability.

By combining mobile-first design with FHE, this app delivers actionable allergen insights while maintaining the highest privacy standards.

---

Built with ❤️ to help users safely navigate dietary choices and allergic risks in a fully privacy-preserving manner.
