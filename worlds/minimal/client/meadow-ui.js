// Example game-owned UX extension: keep all shared controls and add local help.
export function setup({ui}){
 const sharedHelp=ui.toggleHelp.bind(ui);
 ui.toggleHelp=()=>{sharedHelp();const window=ui.windows.get('help');if(!window)return;const note=document.createElement('p');note.dataset.meadowHelp='true';note.textContent='In the meadow, Guide offers three introductory quests and a breadcrumb to Willow rest. Continue uphill to Ridgewatch to discover five compact regions. Supplier sells a larger bag, Keeper provides storage, and each rest stop has a postbox.';window.body.prepend(note);};
 document.documentElement.dataset.uiExtension='meadow';
}
