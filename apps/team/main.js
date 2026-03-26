const grid = document.getElementById('grid');

function createSkillChip(text) {
  const span = document.createElement('span');
  span.className = 'skill';
  span.textContent = text;
  return span;
}

function createCard(member) {
  const card = document.createElement('div');
  card.className = 'card';

  const name = document.createElement('div');
  name.className = 'card__name';
  name.textContent = member.name;

  const role = document.createElement('div');
  role.className = 'card__role';
  role.textContent = member.role;

  const bio = document.createElement('p');
  bio.className = 'card__bio';
  bio.textContent = member.bio;

  const skills = document.createElement('div');
  skills.className = 'card__skills';
  member.skills.forEach(s => skills.appendChild(createSkillChip(s)));

  card.append(name, role, bio, skills);
  return card;
}

fetch('./members.json')
  .then(res => res.json())
  .then(members => {
    members.forEach(member => grid.appendChild(createCard(member)));
  })
  .catch(err => {
    console.error('加载成员数据失败：', err);
    const msg = document.createElement('p');
    msg.className = 'error';
    msg.textContent = '无法加载成员数据，请确认通过 HTTP 服务器访问本页面。';
    grid.appendChild(msg);
  });
