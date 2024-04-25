
const appName = document.getElementById('appName')
const category = document.getElementById('category')
const btnAddName = document.getElementById('btn-addName')

btnAddName.addEventListener('click', () => {
  const name = appName.value
  const cat = category.value
  window.listApi.addName(name, cat)
})

window.listApi.onLoadSavedList((data) => {
  if (data.status === 'OK') {
    appName.value = '';
    category.value = '';
  }
  const listAppsDiv = document.getElementById('listApps');
  listAppsDiv.innerHTML = '';
  data.data?.forEach((value, index) => {
    const listItem = document.createElement('li');
    listItem.textContent = value.name;
    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'X';
    deleteButton.addEventListener('click', () => {
      window.listApi.deleteName(value.name);
    });

    if (index !== 0) {
      const moveToTopButton = document.createElement('button');
      moveToTopButton.textContent = 'Move to Top';
      moveToTopButton.addEventListener('click', () => {
        data.data.splice(index, 1);
        data.data.unshift(value);
        window.listApi.saveList(data.data);
      });
      listItem.appendChild(moveToTopButton);
    }
    listItem.appendChild(deleteButton);
    listAppsDiv.appendChild(listItem);
  });
});

const logs = document.getElementById('logs')
window.listApi.onLog((response) => {
  const li = document.createElement('div')
  li.textContent = `${response.type}: ${response.status} - ${response.message}`
  logs.appendChild(li)
});


