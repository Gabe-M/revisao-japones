const fs = require('fs');

const files = fs.readdirSync('.').filter(f => f.endsWith('.html') && f !== 'anki.html' && f !== 'old_index.html');
let count = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  if (content.includes('<a href="textos.html">📄 Textos</a>') && !content.includes('<a href="anki.html">🎴 Anki</a>')) {
    content = content.replace('<a href="textos.html">📄 Textos</a>', '<a href="textos.html">📄 Textos</a>\n        <a href="anki.html">🎴 Anki</a>');
    fs.writeFileSync(file, content);
    console.log('Updated ' + file);
    count++;
  } else if (content.includes('<a href="perfil.html">👤 Perfil</a>') && !content.includes('<a href="anki.html">🎴 Anki</a>')) {
     content = content.replace('<a href="perfil.html">👤 Perfil</a>', '<a href="anki.html">🎴 Anki</a>\n        <a href="perfil.html">👤 Perfil</a>');
     fs.writeFileSync(file, content);
     console.log('Updated ' + file + ' (via perfil)');
     count++;
  }
}
console.log('Done, updated ' + count + ' files');
