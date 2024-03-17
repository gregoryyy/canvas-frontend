export class FileUploader;

// events sent: uploadsuccess, uploadmsg, uploaderror
class FileUploader {

    // URLs for file upload (POST) and websocket notifications (wss://)
    constructor(uploadUrl, wsUrl) {
        this.uploadUrl = uploadUrl;
        this.wsUrl = wsUrl; 
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
            this.socket.send('client: upload done');
        } catch (error) {
            console.error('Error uploading file:', error);
            document.dispatchEvent(new CustomEvent('uploaderror', { detail: error }));
        }
    }

    connectWebSocket() {
        this.socket = new WebSocket(this.wsUrl);
        this.socket.onopen = () => console.log("WebSocket is open now.");

        this.socket.onmessage = event => {
            console.log("WebSocket message received:", event.data);
            document.dispatchEvent(new CustomEvent('uploadmsg', { detail: event.data }));
        }
        this.socket.onerror = error => console.error("WebSocket error:", error);
    }
}
