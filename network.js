/* copyright 2025 Unlost GmbH. All rights reserved. */

// events sent: uploadsuccess, uploadmsg, uploaderror
class FileUploader {

    // URLs for file upload (POST) and websocket notifications (wss://)
    constructor(uploadUrl, wsUrl) {
        this.uploadUrl = uploadUrl;
        this.ws = WebSock.create(wsUrl);
    }

    initFileInput(fileElemId) {
        const fileInput = document.querySelector(fileElemId);
        fileInput.addEventListener('change', () => {
            const file = fileInput.files[0];
            if (file) {
                this.uploadFile(file);
            }
        });
    }

    async uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(this.uploadUrl, { method: 'POST', body: formData });
            if (!response.ok) throw new Error('Server responded with an error.');
            console.log('Upload successful');
            document.dispatchEvent(new CustomEvent('uploadsuccess', { detail: file }));
            this.ws.socket.send('client: upload done');
        } catch (error) {
            console.error('Error uploading file:', error);
            document.dispatchEvent(new CustomEvent('uploaderror', { detail: error }));
        }
    }
}

class WebSock {

    static instance = undefined;

    // TODO: from config
    maxReconAttempts = 2;
    reconDelay = 5000;

    constructor(wsUrl) {
        this.wsUrl = wsUrl;
        this.reconnectionAttempts = 0;
    }

    // singleton
    static create(wsUrl) {
        WebSock.instance = WebSock.instance || new WebSock(wsUrl);
        WebSock.instance.connect();
        return WebSock.instance;
    }

    connect() {
        this.socket = new window.WebSocket(this.wsUrl);

        this.socket.onopen = () => console.log("WebSocket is open now.");

        this.socket.onmessage = event => {
            console.log("WebSocket message received:", event.data);
            document.dispatchEvent(new CustomEvent('uploadmsg', { detail: event.data }));
        }

        this.socket.onerror = error => console.error("WebSocket error:", error);

        this.socket.onclose = event => {
            console.log("WebSocket is closed now.", event.reason);
            this.reconnect();
        };
    }

    reconnect() {
        if (this.reconnectionAttempts < this.maxReconAttempts) {
            setTimeout(() => {
                console.log(`Attempting to reconnect... (Attempt ${this.reconnectionAttempts + 1})`);
                this.connect();
                this.reconnectionAttempts++;
            }, this.reconDelay);
        } else console.log("Giving up. Max WebSocket reconnection attempts reached.");
    }
}
