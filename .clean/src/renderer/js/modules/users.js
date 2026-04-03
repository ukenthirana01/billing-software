// Users Module
let allUsers = [];
export async function render() {
  const currentUser = window.getCurrentUser();
  if (currentUser?.role !== 'admin') {
    document.getElementById('page-content').innerHTML = `<div class="empty-state"><div class="icon">🔒</div><h3>Access Denied</h3><p>Only administrators can manage users.</p></div>`;
    return;
  }
  allUsers = await api.users.getAll();
  renderUsers();
}
function renderUsers() {
  document.getElementById('page-content').innerHTML = `
    <div class="page-header"><h2>User Management</h2><button class="btn btn-primary" onclick="showAddUser()">+ Add User</button></div>
    <div class="card">
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>#</th><th>Name</th><th>Username</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>${allUsers.map((u,i)=>`
            <tr>
              <td>${i+1}</td>
              <td><strong>${u.name}</strong></td>
              <td>${u.username}</td>
              <td><span class="badge ${u.role==='admin'?'badge-brown':'badge-info'}">${u.role}</span></td>
              <td><span class="badge ${u.active?'badge-success':'badge-danger'}">${u.active?'Active':'Inactive'}</span></td>
              <td class="actions">
                <button class="btn btn-sm btn-secondary" onclick="editUser(${u.id})">✏ Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteUser(${u.id})">🗑</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}
function userForm(u={}) {
  return `<div class="form-grid">
    <div class="form-group"><label class="form-label">Full Name *</label><input class="form-control" id="uf-name" value="${u.name||''}" /></div>
    <div class="form-group"><label class="form-label">Username *</label><input class="form-control" id="uf-uname" value="${u.username||''}" /></div>
    <div class="form-group"><label class="form-label">Password ${u.id?'(leave blank to keep)':''} *</label><input class="form-control" id="uf-pass" type="password" /></div>
    <div class="form-group"><label class="form-label">Role</label><select class="form-control" id="uf-role"><option value="staff" ${u.role==='staff'?'selected':''}>Staff</option><option value="admin" ${u.role==='admin'?'selected':''}>Admin</option></select></div>
    ${u.id?`<div class="form-group"><label class="form-label">Status</label><select class="form-control" id="uf-active"><option value="1" ${u.active?'selected':''}>Active</option><option value="0" ${!u.active?'selected':''}>Inactive</option></select></div>`:''}
  </div>`;
}
window.showAddUser = function() { openModal('Add User', userForm(), `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveUser()">Save</button>`); };
window.editUser = function(id) { const u=allUsers.find(x=>x.id===id); openModal('Edit User', userForm(u), `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveUser(${id})">Update</button>`); };
window.saveUser = async function(id) {
  const data = { name:document.getElementById('uf-name').value.trim(), username:document.getElementById('uf-uname').value.trim(), password:document.getElementById('uf-pass').value, role:document.getElementById('uf-role').value };
  if (!data.name||!data.username) { toast('Name and username required','error'); return; }
  try {
    if (!id && data.password.length < 8) { toast('Password must be at least 8 characters', 'error'); return; }
    if (id) {
      data.id = id;
      data.active = Number(document.getElementById('uf-active')?.value || 1);
      if (data.password && data.password.length < 8) { toast('Password must be at least 8 characters', 'error'); return; }
      await api.users.update(data);
      toast('User updated');
    } else {
      if(!data.password){toast('Password required','error');return;}
      await api.users.add(data);
      toast('User added');
    }
    closeModal();
    allUsers = await api.users.getAll();
    renderUsers();
  } catch (error) {
    toast(error?.message || 'Failed to save user', 'error');
  }
};
window.deleteUser = async function(id) { if(!(await confirmModal('Delete User', 'Are you sure you want to delete this user?')))return; await api.users.delete(id); toast('User deleted'); allUsers=await api.users.getAll(); renderUsers(); };
