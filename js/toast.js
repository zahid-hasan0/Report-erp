// toast.js
export function showToast(message, type = "success") {
    let container = document.getElementById("toastContainer");


    if (!container) {
        container = document.createElement("div");
        container.id = "toastContainer";
        container.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            
            z-index: 9999;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            pointer-events: none;
        `;
        document.body.appendChild(container);
    }

    const toast = document.createElement("div");

    toast.innerHTML = message;

    toast.style.cssText = `
        min-width: 300px;
        max-width: 500px;
        padding: 16px 24px;
        color: white;
        background: ${type === "success"
            ? "linear-gradient(135deg, #0fa80aff, #10b60aff)"
            : "linear-gradient(135deg, #a80909ff, #a80404ff)"};
        border-radius: 12px;
        text-align: center;
        font-weight: 600;
        font-size: 14px;
        font-family: 'Segoe UI', Arial, sans-serif;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
        opacity: 0;
        transform: translateY(-30px);
        pointer-events: auto;
        transition: all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        display: flex;
        align-items: center;
        justify-content: center;
        letter-spacing: 0.2px;
    `;

    container.appendChild(toast);


    requestAnimationFrame(() => {
        toast.style.opacity = 1;
        toast.style.transform = "translateY(0)";
    });

    // Remove after 3 seconds
    setTimeout(() => {
        toast.style.opacity = 0;
        toast.style.transform = "translateY(-30px)";
        setTimeout(() => {
            if (container.contains(toast)) {
                container.removeChild(toast);
            }
        }, 400);
    }, 3000);
}