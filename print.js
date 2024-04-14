function openPrintPopup() {
    const content = document.getElementById('content').innerHTML;

    // Create a popup window
    const printWindow = window.open('', '_blank', 'width=800,height=600');

    // Write the document contents
    printWindow.document.write(`
        <html>
            <head>
                <title>Print Content</title>
                <link rel="preconnect" href="https://fonts.googleapis.com">
                <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                <link
                    href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,400;0,500;0,600;0,900;1,400;1,500;1,600;1,900&display=swap"
                    rel="stylesheet">
                <link rel="stylesheet" href="../styles.css">
                <link rel="stylesheet" href="../aurora.css">
                <link rel="stylesheet" href="canvas.css">
                <link rel="stylesheet" href="layout.css">
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        margin: 0;
                        padding: 20px;
                        line-height: 1.6;
                    }
                    @media print {
                        @page {
                            size: A4;
                            margin: 20mm;
                        }
                        body {
                            margin: 0;
                        }
                    }
                </style>
            </head>
            <body>
                ${content}
                <button onclick="window.print();">Print</button>
                <button onclick="window.close();">Close</button>
            </body>
        </html>
    `);

    printWindow.document.close();  // Ready the document for interactions
}
