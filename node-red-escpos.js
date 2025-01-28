module.exports = function(RED) {
    function EscPosPrinter(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        const net = require('net');

        // ESC/POS Constants
        const FONT_A = Buffer.from([0x1B, 0x4D, 0x00]);
        const FONT_B = Buffer.from([0x1B, 0x4D, 0x01]);
        const BOLD_ON = Buffer.from([0x1B, 0x45, 0x01]);
        const BOLD_OFF = Buffer.from([0x1B, 0x45, 0x00]);
        const ALIGN_LEFT = Buffer.from([0x1B, 0x61, 0x00]);
        const ALIGN_CENTER = Buffer.from([0x1B, 0x61, 0x01]);
        const ALIGN_RIGHT = Buffer.from([0x1B, 0x61, 0x02]);
        const INVERT_ON = Buffer.from([0x1D, 0x42, 0x01]);
        const INVERT_OFF = Buffer.from([0x1D, 0x42, 0x00]);
        const SMOOTH_ON = Buffer.from([0x1B, 0x62, 0x01]);
        const SMOOTH_OFF = Buffer.from([0x1B, 0x62, 0x00]);
        const CUT_FULL = Buffer.from([0x1D, 0x56, 0x00]);
        const PRINT_FEED = Buffer.from([0x1b, 0x64, 0x06]); // Feed 6 lines before cutting

        node.on('input', function(msg) {
            // Retrieve user selections from node config
            const font = config.fontType || "A";
            const width = parseInt(config.width) || 1;
            const height = parseInt(config.height) || 1;
            const align = config.alignment || "left";
            const bold = config.bold || false;
            const invert = config.invert || false;
            const smooth = config.smooth || false;
            const cut = config.cutAfterPrint || false;
            const printerIp = config.ip;
            const printerPort = parseInt(config.port) || 9100;
            let text = config.text ? config.text.trim() : (msg.payload || "").toString().trim();

            if (!text) {
                node.warn("No text to print, skipping...");
                return;
            }

            // Map user inputs to ESC/POS commands
            let fontCommand = font.toLowerCase() === 'a' ? FONT_A : FONT_B;
            let alignCommand = align === "left" ? ALIGN_LEFT : align === "center" ? ALIGN_CENTER : ALIGN_RIGHT;
            let boldCommand = bold ? BOLD_ON : BOLD_OFF;
            let invertCommand = invert ? INVERT_ON : INVERT_OFF;
            let smoothCommand = smooth ? SMOOTH_ON : SMOOTH_OFF;
            let sizeCommand = Buffer.from([0x1D, 0x21, (width - 1) * 0x10 + (height - 1)]); // GS ! n

            // Construct the buffer
            let buffer = Buffer.concat([
                sizeCommand,
                fontCommand,
                alignCommand,
                boldCommand,
                invertCommand,
                smoothCommand,
                Buffer.from(text + '\n')
            ]);

            // Add cut command if enabled
            if (cut) {
                buffer = Buffer.concat([buffer, PRINT_FEED, CUT_FULL]);
            }

            // Create TCP Client
            const client = new net.Socket();
            node.status({ fill: "yellow", shape: "dot", text: "Connecting" });
            node.log(`Connecting to printer at ${printerIp}:${printerPort}`);

            client.connect(printerPort, printerIp, () => {
                node.status({ fill: "green", shape: "dot", text: "Connected" });
                node.log(`Connected to printer at ${printerIp}:${printerPort}`);

                client.write(buffer, () => {
                    node.status({ fill: "green", shape: "dot", text: "Printing successful" });
                    node.log("Print job sent successfully.");
                    client.end(); // Close connection after sending data
                });
            });

            client.on('data', (data) => {
                node.log("Printer response: " + data.toString());
            });

            client.on('error', (err) => {
                let errorMessage = err ? err.message : "Unknown error";
                node.status({ fill: "red", shape: "dot", text: "Error" });
                node.error(`Printer connection error: ${errorMessage}`);
                console.error("Printer connection error:", err);
                client.destroy();
            });

            
            client.on('close', () => {
                //node.status({ fill: "grey", shape: "ring", text: "Disconnected" });
                node.log("Connection to printer closed.");
            });

            //msg.payload = "Print job sent to printer";
            node.send(msg);
        });
    }

    RED.nodes.registerType("EscPos-Printer", EscPosPrinter);
};
