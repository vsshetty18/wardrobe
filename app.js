/* ============================================================
   MY WARDROBE - APP LOGIC
   Fully category-agnostic. No default categories are ever created.
   ============================================================ */

const STORAGE_KEY = "myWardrobeData_v1";

let state = {
  categories: [],   // { id, name, icon, description, subcategories: [{id, name}] }
  items: []         // { id, image, name, categoryId, subcategoryId, color, brand, size, fit, pattern, occasion, createdAt }
};

let ui = {
  activeCategoryTabId: null,     // wardrobe view: which category tab is selected
  editingItemImageData: null,    // base64 of image chosen in Add Item form
  editingCategoryIconData: null, // base64 of image chosen in Category form
  editingCategoryId: null,       // set when editing (not creating) a category
  editingSubcategory: null,      // { categoryId, subId } when editing a subcategory
  addSubcategoryForCategoryId: null,
  deleteCategoryId: null,
  deleteSubcategoryCtx: null,    // { categoryId, subId }
  viewingItemId: null
};

/* ---------------------- PERSISTENCE ---------------------- */

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.categories) && Array.isArray(parsed.items)) {
        state = parsed;
      }
    }
  } catch (e) {
    console.error("Failed to load wardrobe data:", e);
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Failed to save wardrobe data:", e);
    alert("Storage is full. Try removing some images or items to free up space.");
  }
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ---------------------- IMAGE HELPERS ---------------------- */

function readImageAsCompressedDataUrl(file, maxDimension, callback) {
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > height && width > maxDimension) {
        height = Math.round(height * (maxDimension / width));
        width = maxDimension;
      } else if (height > maxDimension) {
        width = Math.round(width * (maxDimension / height));
        height = maxDimension;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      callback(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ---------------------- NAVIGATION ---------------------- */

function switchView(viewName) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active-view"));
  document.getElementById("view-" + viewName).classList.add("active-view");
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === viewName);
  });
  if (viewName === "wardrobe") renderWardrobeView();
  if (viewName === "manageCategories") renderManageCategoriesView();
  if (viewName === "outfitMatcher") renderOutfitMatcherView();
}

document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => switchView(btn.dataset.view));
});

/* ============================================================
   WARDROBE HOME VIEW
   ============================================================ */

function renderWardrobeView() {
  const noCatState = document.getElementById("noCategoriesState");
  const content = document.getElementById("wardrobeContent");
  const addItemTopBtn = document.getElementById("btnAddItemTop");

  if (state.categories.length === 0) {
    noCatState.classList.remove("hidden");
    content.classList.add("hidden");
    addItemTopBtn.classList.add("hidden");
    return;
  }

  noCatState.classList.add("hidden");
  content.classList.remove("hidden");
  addItemTopBtn.classList.remove("hidden");

  if (!ui.activeCategoryTabId || !state.categories.find(c => c.id === ui.activeCategoryTabId)) {
    ui.activeCategoryTabId = state.categories[0].id;
  }

  const tabsEl = document.getElementById("categoryTabs");
  tabsEl.innerHTML = "";
  state.categories.forEach(cat => {
    const tab = document.createElement("button");
    tab.className = "category-tab" + (cat.id === ui.activeCategoryTabId ? " active" : "");
    const iconHtml = cat.iconImage
      ? `<img src="${cat.iconImage}" style="width:16px;height:16px;object-fit:cover;border-radius:3px;vertical-align:middle;margin-right:4px;">`
      : (cat.icon ? cat.icon + " " : "");
    tab.innerHTML = iconHtml + escapeHtml(cat.name);
    tab.addEventListener("click", () => {
      ui.activeCategoryTabId = cat.id;
      renderWardrobeView();
    });
    tabsEl.appendChild(tab);
  });

  const grid = document.getElementById("itemsGrid");
  const noItemsEl = document.getElementById("noItemsInCategory");
  grid.innerHTML = "";

  const itemsInCat = state.items.filter(i => i.categoryId === ui.activeCategoryTabId);

  if (itemsInCat.length === 0) {
    grid.classList.add("hidden");
    noItemsEl.classList.remove("hidden");
    return;
  }
  grid.classList.remove("hidden");
  noItemsEl.classList.add("hidden");

  const activeCat = state.categories.find(c => c.id === ui.activeCategoryTabId);

  itemsInCat.forEach(item => {
    const card = document.createElement("div");
    card.className = "item-card";
    const sub = activeCat.subcategories.find(s => s.id === item.subcategoryId);
    card.innerHTML = `
      ${item.image ? `<img src="${item.image}" alt="${escapeHtml(item.name)}">` : `<div class="no-image">No Image</div>`}
      <div class="item-card-info">
        <div class="item-card-name">${escapeHtml(item.name)}</div>
        <div class="item-card-sub">${sub ? escapeHtml(sub.name) : ""}</div>
      </div>
    `;
    card.addEventListener("click", () => openItemDetail(item.id));
    grid.appendChild(card);
  });
}

document.getElementById("btnCreateFirstCategory").addEventListener("click", () => openCategoryModal());
document.getElementById("btnCreateFirstCategory2").addEventListener("click", () => openCategoryModal());
document.getElementById("btnAddItemTop").addEventListener("click", () => openAddItemModal());
document.getElementById("btnAddItemEmptyCat").addEventListener("click", () => openAddItemModal(ui.activeCategoryTabId));

/* ============================================================
   MANAGE CATEGORIES VIEW
   ============================================================ */

function renderManageCategoriesView() {
  const noCatState = document.getElementById("noCategoriesManageState");
  const list = document.getElementById("categoryManageList");
  list.innerHTML = "";

  if (state.categories.length === 0) {
    noCatState.classList.remove("hidden");
    return;
  }
  noCatState.classList.add("hidden");

  state.categories.forEach((cat, index) => {
    const itemCount = state.items.filter(i => i.categoryId === cat.id).length;

    const card = document.createElement("div");
    card.className = "category-manage-card";

    const iconHtml = cat.iconImage
      ? `<img class="cat-icon-thumb" src="${cat.iconImage}">`
      : (cat.icon ? cat.icon + " " : "");

    const header = document.createElement("div");
    header.className = "category-manage-header";
    header.innerHTML = `
      <div style="display:flex;align-items:center;">
        <div class="reorder-btns">
          <button class="btn-icon" data-action="up" ${index === 0 ? "disabled" : ""}>▲</button>
          <button class="btn-icon" data-action="down" ${index === state.categories.length - 1 ? "disabled" : ""}>▼</button>
        </div>
        <div>
          <div class="category-manage-title">${iconHtml} ${escapeHtml(cat.name)} <span style="color:var(--muted);font-weight:400;font-size:12px;">(${itemCount} item${itemCount === 1 ? "" : "s"})</span></div>
          ${cat.description ? `<div class="category-manage-desc">${escapeHtml(cat.description)}</div>` : ""}
        </div>
      </div>
      <div class="category-manage-actions">
        <button class="btn-icon" data-action="rename">✏️ Rename</button>
        <button class="btn-icon" data-action="delete">🗑️ Delete</button>
      </div>
    `;

    header.querySelector('[data-action="up"]').addEventListener("click", () => moveCategory(cat.id, -1));
    header.querySelector('[data-action="down"]').addEventListener("click", () => moveCategory(cat.id, 1));
    header.querySelector('[data-action="rename"]').addEventListener("click", () => openCategoryModal(cat.id));
    header.querySelector('[data-action="delete"]').addEventListener("click", () => openDeleteCategoryModal(cat.id));

    card.appendChild(header);

    const subList = document.createElement("div");
    subList.className = "subcategory-list";
    cat.subcategories.forEach(sub => {
      const subItemCount = state.items.filter(i => i.categoryId === cat.id && i.subcategoryId === sub.id).length;
      const row = document.createElement("div");
      row.className = "subcategory-row";
      row.innerHTML = `
        <span>${escapeHtml(sub.name)} <span style="color:var(--muted);font-size:11px;">(${subItemCount})</span></span>
        <span class="subcategory-actions">
          <button class="btn-icon" data-action="rename-sub">✏️</button>
          <button class="btn-icon" data-action="delete-sub">🗑️</button>
        </span>
      `;
      row.querySelector('[data-action="rename-sub"]').addEventListener("click", () => openSubcategoryModal(cat.id, sub.id));
      row.querySelector('[data-action="delete-sub"]').addEventListener("click", () => openDeleteSubcategoryModal(cat.id, sub.id));
      subList.appendChild(row);
    });
    card.appendChild(subList);

    const addSubBtn = document.createElement("button");
    addSubBtn.className = "btn btn-secondary btn-add-subcategory";
    addSubBtn.textContent = "+ Add Subcategory";
    addSubBtn.addEventListener("click", () => openSubcategoryModal(cat.id));
    card.appendChild(addSubBtn);

    list.appendChild(card);
  });
}

function moveCategory(catId, direction) {
  const idx = state.categories.findIndex(c => c.id === catId);
  const newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= state.categories.length) return;
  const temp = state.categories[idx];
  state.categories[idx] = state.categories[newIdx];
  state.categories[newIdx] = temp;
  saveState();
  renderManageCategoriesView();
}

document.getElementById("btnOpenCreateCategory").addEventListener("click", () => openCategoryModal());

/* ---------------------- CATEGORY MODAL (with image upload) ---------------------- */

function resetCategoryUploadBox() {
  document.getElementById("inputCategoryIconImage").value = "";
  document.getElementById("categoryUploadPlaceholder").classList.remove("hidden");
  document.getElementById("categoryPreviewWrap").classList.add("hidden");
  document.getElementById("categoryIconPreview").src = "";
  ui.editingCategoryIconData = null;
}

function openCategoryModal(categoryId = null) {
  ui.editingCategoryId = categoryId;
  const modal = document.getElementById("modalCategory");
  const title = document.getElementById("categoryModalTitle");
  const nameInput = document.getElementById("inputCategoryName");
  const iconInput = document.getElementById("inputCategoryIcon");
  const descInput = document.getElementById("inputCategoryDescription");

  resetCategoryUploadBox();

  if (categoryId) {
    const cat = state.categories.find(c => c.id === categoryId);
    title.textContent = "Rename Category";
    nameInput.value = cat.name;
    iconInput.value = cat.icon || "";
    descInput.value = cat.description || "";
    if (cat.iconImage) {
      ui.editingCategoryIconData = cat.iconImage;
      document.getElementById("categoryIconPreview").src = cat.iconImage;
      document.getElementById("categoryUploadPlaceholder").classList.add("hidden");
      document.getElementById("categoryPreviewWrap").classList.remove("hidden");
    }
  } else {
    title.textContent = "Create Category";
    nameInput.value = "";
    iconInput.value = "";
    descInput.value = "";
  }
  modal.classList.remove("hidden");
  nameInput.focus();
}

document.getElementById("inputCategoryIconImage").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  readImageAsCompressedDataUrl(file, 200, (dataUrl) => {
    ui.editingCategoryIconData = dataUrl;
    document.getElementById("categoryIconPreview").src = dataUrl;
    document.getElementById("categoryUploadPlaceholder").classList.add("hidden");
    document.getElementById("categoryPreviewWrap").classList.remove("hidden");
  });
});

document.getElementById("btnRemoveCategoryIcon").addEventListener("click", (e) => {
  e.stopPropagation();
  resetCategoryUploadBox();
});

document.getElementById("btnCancelCategoryModal").addEventListener("click", () => {
  document.getElementById("modalCategory").classList.add("hidden");
});

document.getElementById("btnSaveCategoryModal").addEventListener("click", () => {
  const name = document.getElementById("inputCategoryName").value.trim();
  const icon = document.getElementById("inputCategoryIcon").value.trim();
  const description = document.getElementById("inputCategoryDescription").value.trim();
  const iconImage = ui.editingCategoryIconData || null;

  if (!name) {
    alert("Category name is required.");
    return;
  }

  if (ui.editingCategoryId) {
    const cat = state.categories.find(c => c.id === ui.editingCategoryId);
    cat.name = name;
    cat.icon = icon;
    cat.iconImage = iconImage;
    cat.description = description;
  } else {
    state.categories.push({
      id: uid(),
      name,
      icon,
      iconImage,
      description,
      subcategories: []
    });
  }

  saveState();
  document.getElementById("modalCategory").classList.add("hidden");
  renderManageCategoriesView();
  renderWardrobeView();
});

/* ---------------------- SUBCATEGORY MODAL ---------------------- */

function openSubcategoryModal(categoryId, subId = null) {
  ui.addSubcategoryForCategoryId = categoryId;
  ui.editingSubcategory = subId ? { categoryId, subId } : null;

  const modal = document.getElementById("modalSubcategory");
  const title = document.getElementById("subcategoryModalTitle");
  const nameInput = document.getElementById("inputSubcategoryName");

  if (subId) {
    const cat = state.categories.find(c => c.id === categoryId);
    const sub = cat.subcategories.find(s => s.id === subId);
    title.textContent = "Rename Subcategory";
    nameInput.value = sub.name;
  } else {
    title.textContent = "Create Subcategory";
    nameInput.value = "";
  }
  modal.classList.remove("hidden");
  nameInput.focus();
}

document.getElementById("btnCancelSubcategoryModal").addEventListener("click", () => {
  document.getElementById("modalSubcategory").classList.add("hidden");
});

document.getElementById("btnSaveSubcategoryModal").addEventListener("click", () => {
  const name = document.getElementById("inputSubcategoryName").value.trim();
  if (!name) {
    alert("Subcategory name is required.");
    return;
  }

  if (ui.editingSubcategory) {
    const cat = state.categories.find(c => c.id === ui.editingSubcategory.categoryId);
    const sub = cat.subcategories.find(s => s.id === ui.editingSubcategory.subId);
    sub.name = name;
  } else {
    const cat = state.categories.find(c => c.id === ui.addSubcategoryForCategoryId);
    cat.subcategories.push({ id: uid(), name });
  }

  saveState();
  document.getElementById("modalSubcategory").classList.add("hidden");
  renderManageCategoriesView();
});

/* ---------------------- DELETE CATEGORY MODAL ---------------------- */

function openDeleteCategoryModal(categoryId) {
  ui.deleteCategoryId = categoryId;
  const cat = state.categories.find(c => c.id === categoryId);
  const itemCount = state.items.filter(i => i.categoryId === categoryId).length;

  const msgEl = document.getElementById("deleteCategoryMessage");
  const optionsEl = document.getElementById("deleteCategoryItemsOptions");
  const selectEl = document.getElementById("selectMoveTargetCategory");

  if (itemCount > 0) {
    msgEl.textContent = `This category contains ${itemCount} item${itemCount === 1 ? "" : "s"}. What would you like to do with these items?`;
    optionsEl.classList.remove("hidden");

    selectEl.innerHTML = "";
    state.categories.filter(c => c.id !== categoryId).forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      selectEl.appendChild(opt);
    });

    if (state.categories.length <= 1) {
      selectEl.innerHTML = `<option value="">No other categories available</option>`;
    }

    document.querySelectorAll('input[name="deleteItemsChoice"]').forEach(r => r.checked = false);
    selectEl.classList.add("hidden");
  } else {
    msgEl.textContent = `Are you sure you want to delete "${cat.name}"?`;
    optionsEl.classList.add("hidden");
  }

  document.getElementById("modalDeleteCategory").classList.remove("hidden");
}

document.querySelectorAll('input[name="deleteItemsChoice"]').forEach(radio => {
  radio.addEventListener("change", () => {
    const selectEl = document.getElementById("selectMoveTargetCategory");
    selectEl.classList.toggle("hidden", radio.value !== "move" || !radio.checked);
  });
});

document.getElementById("btnCancelDeleteCategory").addEventListener("click", () => {
  document.getElementById("modalDeleteCategory").classList.add("hidden");
});

document.getElementById("btnConfirmDeleteCategory").addEventListener("click", () => {
  const categoryId = ui.deleteCategoryId;
  const itemCount = state.items.filter(i => i.categoryId === categoryId).length;

  if (itemCount > 0) {
    const choice = document.querySelector('input[name="deleteItemsChoice"]:checked');
    if (!choice) {
      alert("Please choose what to do with the items in this category.");
      return;
    }
    if (choice.value === "move") {
      const targetId = document.getElementById("selectMoveTargetCategory").value;
      if (!targetId) {
        alert("No category available to move items to. Please delete the items instead, or create another category first.");
        return;
      }
      const targetCat = state.categories.find(c => c.id === targetId);
      state.items.forEach(i => {
        if (i.categoryId === categoryId) {
          i.categoryId = targetId;
          i.subcategoryId = targetCat.subcategories[0] ? targetCat.subcategories[0].id : null;
        }
      });
    } else if (choice.value === "delete") {
      state.items = state.items.filter(i => i.categoryId !== categoryId);
    }
  }

  state.categories = state.categories.filter(c => c.id !== categoryId);
  if (ui.activeCategoryTabId === categoryId) ui.activeCategoryTabId = null;

  saveState();
  document.getElementById("modalDeleteCategory").classList.add("hidden");
  renderManageCategoriesView();
  renderWardrobeView();
});

/* ---------------------- DELETE SUBCATEGORY MODAL ---------------------- */

function openDeleteSubcategoryModal(categoryId, subId) {
  ui.deleteSubcategoryCtx = { categoryId, subId };
  const cat = state.categories.find(c => c.id === categoryId);
  const sub = cat.subcategories.find(s => s.id === subId);
  const itemCount = state.items.filter(i => i.categoryId === categoryId && i.subcategoryId === subId).length;

  const msgEl = document.getElementById("deleteSubcategoryMessage");
  msgEl.textContent = itemCount > 0
    ? `"${sub.name}" contains ${itemCount} item${itemCount === 1 ? "" : "s"}. Deleting it will unassign those items' subcategory. Continue?`
    : `Are you sure you want to delete "${sub.name}"?`;

  document.getElementById("modalDeleteSubcategory").classList.remove("hidden");
}

document.getElementById("btnCancelDeleteSubcategory").addEventListener("click", () => {
  document.getElementById("modalDeleteSubcategory").classList.add("hidden");
});

document.getElementById("btnConfirmDeleteSubcategory").addEventListener("click", () => {
  const { categoryId, subId } = ui.deleteSubcategoryCtx;
  const cat = state.categories.find(c => c.id === categoryId);
  cat.subcategories = cat.subcategories.filter(s => s.id !== subId);
  state.items.forEach(i => {
    if (i.categoryId === categoryId && i.subcategoryId === subId) i.subcategoryId = null;
  });
  saveState();
  document.getElementById("modalDeleteSubcategory").classList.add("hidden");
  renderManageCategoriesView();
});

/* ============================================================
   ADD ITEM FLOW (with image upload box)
   ============================================================ */

function resetItemUploadBox() {
  document.getElementById("inputItemImage").value = "";
  document.getElementById("itemUploadPlaceholder").classList.remove("hidden");
  document.getElementById("itemPreviewWrap").classList.add("hidden");
  document.getElementById("itemImagePreview").src = "";
  ui.editingItemImageData = null;
}

function openAddItemModal(preselectCategoryId = null) {
  const noCatEl = document.getElementById("addItemNoCategories");
  const formEl = document.getElementById("addItemForm");

  if (state.categories.length === 0) {
    noCatEl.classList.remove("hidden");
    formEl.classList.add("hidden");
    document.getElementById("modalAddItem").classList.remove("hidden");
    return;
  }
  noCatEl.classList.add("hidden");
  formEl.classList.remove("hidden");

  resetItemUploadBox();
  document.getElementById("inputItemName").value = "";
  document.getElementById("inputItemColor").value = "";
  document.getElementById("inputItemBrand").value = "";
  document.getElementById("inputItemSize").value = "";
  document.getElementById("inputItemFit").value = "";
  document.getElementById("inputItemPattern").value = "";
  document.getElementById("inputItemOccasion").value = "";

  const catSelect = document.getElementById("selectItemCategory");
  catSelect.innerHTML = "";
  state.categories.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.name;
    catSelect.appendChild(opt);
  });
  catSelect.value = preselectCategoryId || state.categories[0].id;
  populateSubcategorySelect(catSelect.value);

  document.getElementById("modalAddItem").classList.remove("hidden");
}

function populateSubcategorySelect(categoryId) {
  const subSelect = document.getElementById("selectItemSubcategory");
  subSelect.innerHTML = "";
  const cat = state.categories.find(c => c.id === categoryId);
  if (!cat || cat.subcategories.length === 0) {
    subSelect.innerHTML = `<option value="">No subcategories — add one in Manage Categories</option>`;
    return;
  }
  cat.subcategories.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.name;
    subSelect.appendChild(opt);
  });
}

document.getElementById("selectItemCategory").addEventListener("change", (e) => {
  populateSubcategorySelect(e.target.value);
});

document.getElementById("btnAddItemGoCreateCategory").addEventListener("click", () => {
  document.getElementById("modalAddItem").classList.add("hidden");
  switchView("manageCategories");
  openCategoryModal();
});

document.getElementById("inputItemImage").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  readImageAsCompressedDataUrl(file, 800, (dataUrl) => {
    ui.editingItemImageData = dataUrl;
    document.getElementById("itemImagePreview").src = dataUrl;
    document.getElementById("itemUploadPlaceholder").classList.add("hidden");
    document.getElementById("itemPreviewWrap").classList.remove("hidden");
  });
});

document.getElementById("btnRemoveItemImage").addEventListener("click", (e) => {
  e.stopPropagation();
  resetItemUploadBox();
});

document.getElementById("btnCancelAddItem").addEventListener("click", () => {
  document.getElementById("modalAddItem").classList.add("hidden");
});

document.getElementById("btnSaveItem").addEventListener("click", () => {
  const name = document.getElementById("inputItemName").value.trim();
  const categoryId = document.getElementById("selectItemCategory").value;
  const subcategoryId = document.getElementById("selectItemSubcategory").value || null;

  if (!name) {
    alert("Item name is required.");
    return;
  }
  if (!categoryId) {
    alert("Please select a category.");
    return;
  }

  const newItem = {
    id: uid(),
    image: ui.editingItemImageData || null,
    name,
    categoryId,
    subcategoryId,
    color: document.getElementById("inputItemColor").value.trim(),
    brand: document.getElementById("inputItemBrand").value.trim(),
    size: document.getElementById("inputItemSize").value.trim(),
    fit: document.getElementById("inputItemFit").value.trim(),
    pattern: document.getElementById("inputItemPattern").value.trim(),
    occasion: document.getElementById("inputItemOccasion").value.trim(),
    createdAt: Date.now()
  };

  state.items.push(newItem);
  saveState();
  document.getElementById("modalAddItem").classList.add("hidden");
  ui.activeCategoryTabId = categoryId;
  renderWardrobeView();
});

/* ============================================================
   ITEM DETAIL / DELETE ITEM
   ============================================================ */

function openItemDetail(itemId) {
  ui.viewingItemId = itemId;
  const item = state.items.find(i => i.id === itemId);
  const cat = state.categories.find(c => c.id === item.categoryId);
  const sub = cat ? cat.subcategories.find(s => s.id === item.subcategoryId) : null;

  const content = document.getElementById("itemDetailContent");
  content.innerHTML = `
    ${item.image ? `<img class="item-detail-img" src="${item.image}">` : ""}
    <div class="item-detail-row"><span>Name</span><span>${escapeHtml(item.name)}</span></div>
    <div class="item-detail-row"><span>Category</span><span>${cat ? escapeHtml(cat.name) : "—"}</span></div>
    <div class="item-detail-row"><span>Subcategory</span><span>${sub ? escapeHtml(sub.name) : "—"}</span></div>
    ${item.color ? `<div class="item-detail-row"><span>Color</span><span>${escapeHtml(item.color)}</span></div>` : ""}
    ${item.brand ? `<div class="item-detail-row"><span>Brand</span><span>${escapeHtml(item.brand)}</span></div>` : ""}
    ${item.size ? `<div class="item-detail-row"><span>Size</span><span>${escapeHtml(item.size)}</span></div>` : ""}
    ${item.fit ? `<div class="item-detail-row"><span>Fit</span><span>${escapeHtml(item.fit)}</span></div>` : ""}
    ${item.pattern ? `<div class="item-detail-row"><span>Pattern</span><span>${escapeHtml(item.pattern)}</span></div>` : ""}
    ${item.occasion ? `<div class="item-detail-row"><span>Occasion</span><span>${escapeHtml(item.occasion)}</span></div>` : ""}
  `;

  document.getElementById("modalItemDetail").classList.remove("hidden");
}

document.getElementById("btnCloseItemDetail").addEventListener("click", () => {
  document.getElementById("modalItemDetail").classList.add("hidden");
});

document.getElementById("btnDeleteItemDetail").addEventListener("click", () => {
  if (!confirm("Delete this item?")) return;
  state.items = state.items.filter(i => i.id !== ui.viewingItemId);
  saveState();
  document.getElementById("modalItemDetail").classList.add("hidden");
  renderWardrobeView();
});

/* ============================================================
   OUTFIT MATCHER (fully dynamic, category-agnostic)
   ============================================================ */

let outfitSelections = {}; // categoryId -> itemId

function renderOutfitMatcherView() {
  const container = document.getElementById("outfitMatcherContent");
  container.innerHTML = "";

  if (state.categories.length === 0) {
    container.innerHTML = `<div class="empty-state"><p class="empty-title">Create categories and add items first to use the Outfit Matcher.</p></div>`;
    return;
  }

  const categoriesWithItems = state.categories.filter(cat =>
    state.items.some(i => i.categoryId === cat.id)
  );

  if (categoriesWithItems.length === 0) {
    container.innerHTML = `<div class="empty-state"><p class="empty-title">Add some clothing items first to build an outfit.</p></div>`;
    return;
  }

  Object.keys(outfitSelections).forEach(catId => {
    if (!categoriesWithItems.find(c => c.id === catId)) delete outfitSelections[catId];
  });

  categoriesWithItems.forEach(cat => {
    const slot = document.createElement("div");
    slot.className = "matcher-slot";
    const itemsInCat = state.items.filter(i => i.categoryId === cat.id);

    const h3 = document.createElement("h3");
    const iconHtml = cat.iconImage
      ? `<img src="${cat.iconImage}" style="width:16px;height:16px;object-fit:cover;border-radius:3px;vertical-align:middle;margin-right:4px;">`
      : (cat.icon ? cat.icon + " " : "");
    h3.innerHTML = iconHtml + escapeHtml(cat.name);
    slot.appendChild(h3);

    const grid = document.createElement("div");
    grid.className = "matcher-item-select-grid";

    itemsInCat.forEach(item => {
      const opt = document.createElement("div");
      opt.className = "matcher-item-option" + (outfitSelections[cat.id] === item.id ? " selected" : "");
      opt.innerHTML = `
        ${item.image ? `<img src="${item.image}">` : `<div class="no-image">No Image</div>`}
        <div class="opt-name">${escapeHtml(item.name)}</div>
      `;
      opt.addEventListener("click", () => {
        if (outfitSelections[cat.id] === item.id) {
          delete outfitSelections[cat.id];
        } else {
          outfitSelections[cat.id] = item.id;
        }
        renderOutfitMatcherView();
      });
      grid.appendChild(opt);
    });

    slot.appendChild(grid);
    container.appendChild(slot);
  });

  const summary = document.createElement("div");
  summary.className = "matcher-summary";
  const chosenIds = Object.values(outfitSelections);
  if (chosenIds.length === 0) {
    summary.innerHTML = `<strong>Your Outfit:</strong> No items selected yet.`;
  } else {
    const names = chosenIds.map(id => {
      const it = state.items.find(i => i.id === id);
      return it ? escapeHtml(it.name) : "";
    }).filter(Boolean);
    summary.innerHTML = `<strong>Your Outfit:</strong> ${names.join(" + ")}`;
  }
  container.appendChild(summary);
}

/* ============================================================
   INIT
   ============================================================ */

function init() {
  loadState();
  renderWardrobeView();
}

init();
