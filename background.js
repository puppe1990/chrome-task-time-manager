// Background service worker para a extensão Task Time Manager
chrome.runtime.onInstalled.addListener(() => {
  console.log("Task Time Manager instalado com sucesso!");
});

// Listener para mensagens do popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getTasks") {
    chrome.storage.local.get(['tasks'], (result) => {
      sendResponse({ tasks: result.tasks || [] });
    });
    return true; // Mantém o canal de mensagem aberto para resposta assíncrona
  }
  
  if (request.action === "saveTasks") {
    chrome.storage.local.set({ tasks: request.tasks }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});
