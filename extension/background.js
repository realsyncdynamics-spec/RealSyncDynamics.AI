// background.js - Service Worker für die Chrome Extension

chrome.runtime.onInstalled.addListener(() => {
  // Kontext-Menü Eintrag beim Rechtsklick erstellen
  chrome.contextMenus.create({
    id: "ask-ai-explain",
    title: "Mit AI erklären",
    contexts: ["selection"]
  });

  // Erlaubt das Öffnen der Sidebar beim Klick auf das Extension-Icon
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
});

// Wenn der User im Kontextmenü (Rechtsklick) etwas auswählt
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "ask-ai-explain" && tab?.id) {
    // Öffne das Side-Panel im aktuellen Tab
    chrome.sidePanel.open({ tabId: tab.id });
    
    // Sende den markierten Text an das Side-Panel (das React Frontend)
    setTimeout(() => {
      chrome.runtime.sendMessage({ 
        type: "CONTEXT_SELECTION", 
        payload: info.selectionText 
      });
    }, 500); // Kurzer Delay stellt sicher, dass das Panel geladen ist
  }
});

// Empfängt Anfragen aus der Sidebar, um sie an das zentrale Backend zu senden
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "API_CALL") {
    // Hier rufen wir das Multi-Model Gateway aus unserem Backend auf
    // z.B. fetch('https://dein-backend.com/api/gateway', { ... })
    
    console.log("Routing via Extension Service Worker:", request.provider);
    
    // Mock-Antwort (bis die REST-API erreichbar ist)
    setTimeout(() => {
      sendResponse({ 
        text: `Dies ist eine Antwort von ${request.provider} für den Prompt: "${request.prompt}"` 
      });
    }, 800);
    
    return true; // Asynchrone Antwort signalisieren
  }
});
