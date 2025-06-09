/**
 * Nexus Inventory Management System
 * Professional JavaScript Module
 * Version: 2.4.1
 */

class InventoryManager {
    constructor() {
        this.items = [];
        this.isLoading = false;
        this.notifications = [];
        this.init();
    }

    /**
     * Initialize the inventory management system
     */
    init() {
        this.setupEventListeners();
        this.setupModal();
        this.updateClock();
        this.startClockInterval();
        console.log('Nexus Inventory System initialized');
    }

    /**
     * Setup event listeners for UI interactions
     */
    setupEventListeners() {
        // Button event listeners
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-action]')) {
                this.handleAction(e.target.dataset.action);
            }
            
            if (e.target.matches('.icon-btn')) {
                this.handleIconAction(e.target);
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
                    case 'n':
                        e.preventDefault();
                        this.handleAction('add');
                        break;
                    case 'd':
                        e.preventDefault();
                        this.handleAction('remove');
                        break;
                    case 'm':
                        e.preventDefault();
                        this.handleAction('modify');
                        break;
                    case 'r':
                        e.preventDefault();
                        this.refreshData();
                        break;
                }
            }
        });

        // Window events
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
    }

    /**
     * Setup modal functionality
     */
    setupModal() {
        const addItemBtn = document.querySelector('[data-action="add"]');
        const modal = document.getElementById('addItemModal');
        const closeModal = document.querySelector('.close-modal');
        const cancelBtn = document.getElementById('cancelAdd');
        const confirmBtn = document.getElementById('confirmAdd');
        const tableSelect = document.getElementById('addItemTableSelect');
        const rowCount = document.getElementById('rowCount');
        const rowsContainer = document.getElementById('rowsContainer');

        // Database tables with their attributes
        const tables = [
            {
                name: 'Products',
                attributes: [
                    { name: 'product_id', type: 'int', isPrimary: true },
                    { name: 'name', type: 'varchar' },
                    { name: 'brand', type: 'varchar' },
                    { name: 'barcode', type: 'varchar' },
                    { name: 'is_perishable', type: 'boolean' },
                    { name: 'unit_of_measure', type: 'varchar' }
                ]
            },
            {
                name: 'DarkStores',
                attributes: [
                    { name: 'store_id', type: 'int', isPrimary: true },
                    { name: 'name', type: 'varchar' },
                    { name: 'location', type: 'varchar' },
                    { name: 'region', type: 'varchar' },
                    { name: 'contact_info', type: 'varchar' }
                ]
            },
            {
                name: 'Inventory',
                attributes: [
                    { name: 'inventory_id', type: 'int', isPrimary: true },
                    { name: 'product_id', type: 'int', isForeign: true, references: 'Products' },
                    { name: 'store_id', type: 'int', isForeign: true, references: 'DarkStores' },
                    { name: 'quantity_available', type: 'int' },
                    { name: 'quantity_reserved', type: 'int' },
                    { name: 'reorder_threshold', type: 'int' },
                    { name: 'last_updated', type: 'datetime' }
                ]
            },
            {
                name: 'Orders',
                attributes: [
                    { name: 'order_id', type: 'int', isPrimary: true },
                    { name: 'customer_id', type: 'int' },
                    { name: 'store_id', type: 'int', isForeign: true, references: 'DarkStores' },
                    { name: 'order_timestamp', type: 'datetime' },
                    { name: 'status', type: 'varchar' },
                    { name: 'delivery_slot', type: 'varchar' }
                ]
            },
            {
                name: 'OrderItems',
                attributes: [
                    { name: 'order_item_id', type: 'int', isPrimary: true },
                    { name: 'order_id', type: 'int', isForeign: true, references: 'Orders' },
                    { name: 'product_id', type: 'int', isForeign: true, references: 'Products' },
                    { name: 'quantity', type: 'int' },
                    { name: 'unit_price', type: 'decimal' },
                    { name: 'discount', type: 'decimal' }
                ]
            },
            {
                name: 'Users',
                attributes: [
                    { name: 'user_id', type: 'int', isPrimary: true },
                    { name: 'name', type: 'varchar' },
                    { name: 'role', type: 'varchar' },
                    { name: 'store_id', type: 'int', isForeign: true, references: 'DarkStores' },
                    { name: 'login_credentials', type: 'varchar' }
                ]
            },
            {
                name: 'StockMovements',
                attributes: [
                    { name: 'movement_id', type: 'int', isPrimary: true },
                    { name: 'product_id', type: 'int', isForeign: true, references: 'Products' },
                    { name: 'store_id', type: 'int', isForeign: true, references: 'DarkStores' },
                    { name: 'type', type: 'varchar' },
                    { name: 'quantity', type: 'int' },
                    { name: 'timestamp', type: 'datetime' },
                    { name: 'reference', type: 'varchar' }
                ]
            }
        ];

        // Populate table select
        tables.forEach(table => {
            const option = document.createElement('option');
            option.value = table.name;
            option.textContent = table.name;
            tableSelect.appendChild(option);
        });

        // Show modal
        addItemBtn.addEventListener('click', () => {
            modal.classList.add('active');
            rowsContainer.innerHTML = ''; // Clear existing rows
            this.updateRows();
        });

        // Handle confirm button click
        confirmBtn.addEventListener('click', async () => {
            const selectedTable = tableSelect.value;
            if (!selectedTable) {
                this.showNotification('Please select a table first', 'error');
                return;
            }

            const rows = rowsContainer.querySelectorAll('.row-group');
            const data = [];

            for (const row of rows) {
                const rowData = {};
                const inputs = row.querySelectorAll('input, select');
                
                for (const input of inputs) {
                    const fieldName = input.getAttribute('data-field');
                    let value = input.value;

                    // Convert value based on type
                    if (input.type === 'number') {
                        value = parseFloat(value);
                    } else if (input.type === 'checkbox') {
                        value = input.checked;
                    }

                    rowData[fieldName] = value;
                }

                data.push(rowData);
            }

            try {
                let successCount = 0;
                let errorCount = 0;
                const totalRows = data.length;

                this.showNotification(`Attempting to add ${totalRows} item(s) to ${selectedTable}...`, 'info');

                for (const rowData of data) {
                    try {
                        const response = await fetch(`http://localhost:5000/add-${selectedTable}`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(rowData)
                        });

                        if (!response.ok) {
                            // Attempt to read the error message from the backend response
                            const errorResult = await response.json().catch(() => ({ error: 'Unknown error' }));
                            console.error(`Error adding item to ${selectedTable}:`, errorResult.error || response.statusText);
                            errorCount++;
                        } else {
                            successCount++;
                        }
                    } catch (error) {
                        console.error(`Network error while adding item to ${selectedTable}:`, error);
                        errorCount++;
                    }
                }

                if (successCount > 0) {
                    this.showNotification(`${successCount} item(s) added successfully to ${selectedTable}!`, 'success');
                }
                if (errorCount > 0) {
                    this.showNotification(`${errorCount} item(s) failed to add to ${selectedTable}. Check console for details.`, 'error');
                }

                if (successCount > 0) { // Only close modal and refresh if at least one item was added successfully
                     hideModal();
                     this.refreshData(); // Refresh the table data
                }

            } catch (error) {
                console.error('Error processing add requests:', error);
                this.showNotification('An unexpected error occurred while adding items.', 'error');
            }
        });

        // Hide modal
        const hideModal = () => {
            modal.classList.remove('active');
            rowsContainer.innerHTML = ''; // Clear rows when closing
        };

        closeModal.addEventListener('click', hideModal);
        cancelBtn.addEventListener('click', hideModal);

        // Create attribute field
        const createAttributeField = (attr) => {
            const fieldDiv = document.createElement('div');
            fieldDiv.className = 'attribute-field';
            
            const label = document.createElement('label');
            label.textContent = attr.name;
            label.className = 'attribute-label';
            
            let input;
            if (attr.type === 'boolean') {
                input = document.createElement('select');
                input.className = 'futuristic-select';
                const trueOption = document.createElement('option');
                trueOption.value = 'true';
                trueOption.textContent = 'True';
                const falseOption = document.createElement('option');
                falseOption.value = 'false';
                falseOption.textContent = 'False';
                input.appendChild(trueOption);
                input.appendChild(falseOption);
            } else if (attr.type === 'datetime') {
                input = document.createElement('input');
                input.type = 'datetime-local';
                input.className = 'futuristic-input';
            } else if (attr.type === 'decimal') {
                input = document.createElement('input');
                input.type = 'number';
                input.step = '0.01';
                input.className = 'futuristic-input';
            } else if (attr.type === 'int') {
                input = document.createElement('input');
                input.type = 'number';
                input.className = 'futuristic-input';
            } else {
                input = document.createElement('input');
                input.type = 'text';
                input.className = 'futuristic-input';
            }

            // if (attr.isPrimary) {
            //     input.disabled = true;
            //     input.placeholder = 'Auto-generated';
            // } else if (attr.isForeign) {
            //     input.placeholder = `Select ${attr.references} ID`;
            // } else {
            //     input.placeholder = `Enter ${attr.name}`;
            // }
            
            // Set placeholder based on whether it's a foreign key or a regular field
            if (attr.isForeign) {
                input.placeholder = `Select ${attr.references} ID`;
            } else if (!attr.isPrimary) { // For non-primary, non-foreign keys
                input.placeholder = `Enter ${attr.name}`;
            } else { // For primary keys, prompt for input
                 input.placeholder = `Enter ${attr.name} (Required)`;
            }

             // Add a data attribute to easily identify the field name later
            input.setAttribute('data-field', attr.name);

            fieldDiv.appendChild(label);
            fieldDiv.appendChild(input);
            return fieldDiv;
        };

        // Create a row group
        const createRowGroup = (rowIndex, selectedTable) => {
            const rowGroup = document.createElement('div');
            rowGroup.className = 'row-group';
            
            const rowHeader = document.createElement('div');
            rowHeader.className = 'row-header';
            
            const rowTitle = document.createElement('div');
            rowTitle.className = 'row-title';
            rowTitle.textContent = `Row ${rowIndex + 1}`;
            
            rowHeader.appendChild(rowTitle);
            rowGroup.appendChild(rowHeader);
            
            const rowContent = document.createElement('div');
            rowContent.className = 'row-content';
            
            const selectedTableData = tables.find(t => t.name === selectedTable);
            if (selectedTableData) {
                selectedTableData.attributes.forEach(attr => {
                    rowContent.appendChild(createAttributeField(attr));
                });
            }
            
            rowGroup.appendChild(rowContent);
            return rowGroup;
        };

        // Update rows based on count
        this.updateRows = () => {
            const count = parseInt(rowCount.value) || 1;
            const selectedTable = tableSelect.value;
            
            if (!selectedTable) {
                rowsContainer.innerHTML = '<div class="no-table-selected">Please select a table first</div>';
                return;
            }
            
            rowsContainer.innerHTML = '';
            for (let i = 0; i < count; i++) {
                rowsContainer.appendChild(createRowGroup(i, selectedTable));
            }
        };

        // Event listeners for dynamic updates
        tableSelect.addEventListener('change', this.updateRows);
        rowCount.addEventListener('change', this.updateRows);
        rowCount.addEventListener('input', this.updateRows);

        // Modify Modal Setup
        const modifyItemBtn = document.querySelector('[data-action="modify"]');
        const modifyModal = document.getElementById('modifyItemModal');
        const modifyCloseModal = modifyModal.querySelector('.close-modal');
        const cancelModifyBtn = document.getElementById('cancelModify');
        const confirmModifyBtn = document.getElementById('confirmModify');
        const modifyRowCount = document.getElementById('modifyRowCount');
        const modifyRowsContainer = document.getElementById('modifyRowsContainer');

        // Show modify modal
        modifyItemBtn.addEventListener('click', () => {
            modifyModal.classList.add('active');
            this.updateModifyRows();
        });

        // Hide modify modal
        const hideModifyModal = () => {
            modifyModal.classList.remove('active');
        };

        modifyCloseModal.addEventListener('click', hideModifyModal);
        cancelModifyBtn.addEventListener('click', hideModifyModal);

        // Create modify row group
        const createModifyRowGroup = (rowIndex) => {
            const rowGroup = document.createElement('div');
            rowGroup.className = 'row-group';
            
            const rowHeader = document.createElement('div');
            rowHeader.className = 'row-header';
            
            const rowTitle = document.createElement('div');
            rowTitle.className = 'row-title';
            rowTitle.textContent = `Row ${rowIndex + 1}`;
            
            const removeButton = document.createElement('button');
            removeButton.className = 'remove-row';
            removeButton.innerHTML = '×';
            removeButton.onclick = () => rowGroup.remove();
            
            rowHeader.appendChild(rowTitle);
            rowHeader.appendChild(removeButton);

            // Table selection
            const tableSelect = document.createElement('select');
            tableSelect.className = 'futuristic-select';
            tableSelect.id = `tableSelect-${rowIndex}`;
            
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = 'Select Table';
            tableSelect.appendChild(defaultOption);

            tables.forEach(table => {
                const option = document.createElement('option');
                option.value = table.name;
                option.textContent = table.name;
                tableSelect.appendChild(option);
            });

            // ID input
            const idInput = document.createElement('input');
            idInput.type = 'text';
            idInput.className = 'futuristic-input';
            idInput.placeholder = 'Enter ID to modify';
            idInput.id = `idInput-${rowIndex}`;

            // Attributes container
            const attributesContainer = document.createElement('div');
            attributesContainer.className = 'attributes-container';
            attributesContainer.id = `attributes-${rowIndex}`;

            // Update attributes when table changes
            tableSelect.addEventListener('change', () => {
                const selectedTable = tables.find(t => t.name === tableSelect.value);
                attributesContainer.innerHTML = '';

                if (selectedTable) {
                    selectedTable.attributes.forEach(attr => {
                        if (!attr.isPrimary) {
                            const attrDiv = document.createElement('div');
                            attrDiv.className = 'attribute-field';

                            const label = document.createElement('label');
                            label.textContent = attr.name;
                            label.className = 'attribute-label';

                            const checkbox = document.createElement('input');
                            checkbox.type = 'checkbox';
                            checkbox.className = 'modify-checkbox';
                            checkbox.dataset.attribute = attr.name;

                            // Create input/select with generic placeholder
                            let input;
                            if (attr.type === 'boolean') {
                                input = document.createElement('select');
                                input.className = 'futuristic-select';
                                const trueOption = document.createElement('option');
                                trueOption.value = 'true';
                                trueOption.textContent = 'True';
                                const falseOption = document.createElement('option');
                                falseOption.value = 'false';
                                falseOption.textContent = 'False';
                                input.appendChild(trueOption);
                                input.appendChild(falseOption);
                            } else if (attr.type === 'datetime') {
                                input = document.createElement('input');
                                input.type = 'datetime-local';
                                input.className = 'futuristic-input';
                                input.placeholder = 'Select date & time';
                            } else if (attr.type === 'decimal') {
                                input = document.createElement('input');
                                input.type = 'number';
                                input.step = '0.01';
                                input.className = 'futuristic-input';
                                input.placeholder = 'Enter value';
                            } else if (attr.type === 'int') {
                                input = document.createElement('input');
                                input.type = 'number';
                                input.className = 'futuristic-input';
                                input.placeholder = 'Enter value';
                            } else {
                                input = document.createElement('input');
                                input.type = 'text';
                                input.className = 'futuristic-input';
                                input.placeholder = 'Enter value';
                            }

                            input.disabled = true;

                            checkbox.addEventListener('change', () => {
                                input.disabled = !checkbox.checked;
                                if (!checkbox.checked) {
                                    input.value = '';
                                }
                            });

                            attrDiv.appendChild(label);
                            attrDiv.appendChild(checkbox);
                            attrDiv.appendChild(input);
                            attributesContainer.appendChild(attrDiv);
                        }
                    });
                }
            });

            const tableGroup = document.createElement('div');
            tableGroup.className = 'table-id-group';
            tableGroup.appendChild(tableSelect);
            tableGroup.appendChild(idInput);

            rowGroup.appendChild(rowHeader);
            rowGroup.appendChild(tableGroup);
            rowGroup.appendChild(attributesContainer);
            
            return rowGroup;
        };

        // Update modify rows
        this.updateModifyRows = () => {
            const count = parseInt(modifyRowCount.value) || 1;
            modifyRowsContainer.innerHTML = '';
            
            for (let i = 0; i < count; i++) {
                modifyRowsContainer.appendChild(createModifyRowGroup(i));
            }
        };

        // Update modify rows when count changes
        modifyRowCount.addEventListener('change', () => this.updateModifyRows());

        // Handle modify form submission
        confirmModifyBtn.addEventListener('click', async () => {
            const rowGroups = modifyRowsContainer.querySelectorAll('.row-group');
            const modifications = Array.from(rowGroups).map(rowGroup => {
                const tableSelect = rowGroup.querySelector('select');
                const idInput = rowGroup.querySelector('input[type="text"]');
                const attributes = Array.from(rowGroup.querySelectorAll('.attribute-field')).map(attrField => {
                    const checkbox = attrField.querySelector('.modify-checkbox');
                    const input = attrField.querySelector('input:not([type="checkbox"]), select');
                    if (checkbox.checked) {
                        return {
                            name: checkbox.dataset.attribute,
                            value: input.value
                        };
                    }
                    return null;
                }).filter(attr => attr !== null);

                return {
                    table: tableSelect.value,
                    id: idInput.value,
                    attributes: attributes
                };
            });

            let successfulUpdates = 0;
            let failedUpdates = 0;
            const totalModifications = modifications.length;

            this.showNotification(`Attempting to modify ${totalModifications} item(s)...`, 'info');

            try {
                // Process each modification
                for (const mod of modifications) {
                    if (!mod.table || !mod.id || mod.attributes.length === 0) {
                        this.showNotification('Please fill in all required fields for all rows', 'error');
                        failedUpdates++; // Consider this a failed update attempt
                        continue; // Skip this modification but continue with others
                    }

                    // Convert attributes array to object format expected by backend
                    const attributeList = {};
                    mod.attributes.forEach(attr => {
                        attributeList[attr.name] = attr.value;
                    });

                    try {
                        // Make API call to update_row endpoint
                        // We will assume success if the fetch call completes without a network error
                        const response = await this.apiCall('PUT', 'http://localhost:5000/update-row', {
                            table_name: mod.table,
                            key: mod.id,
                            attribute_list: attributeList
                        });
                        
                        // If we get a response without throwing a network error, assume success for this item.
                        successfulUpdates++;

                    } catch (apiError) {
                        // Catch errors from the apiCall itself (e.g., network errors)
                        console.error(`Failed to update item (Table: ${mod.table}, ID: ${mod.id}):`, apiError);
                        failedUpdates++;
                        this.showNotification(`Failed to update item (ID: ${mod.id}). Check console.`, 'error');
                    }
                }

                // Provide a summary notification after attempting all updates
                if (successfulUpdates > 0) {
                    this.showNotification(`${successfulUpdates} item(s) updated successfully.`, 'success');
                     hideModifyModal(); // Close modal only on success
                     this.refreshData(); // Refresh data to show changes
                }

                if (failedUpdates > 0) {
                     this.showNotification(`${failedUpdates} item(s) failed to update. See console for details.`, 'error');
                }

            } catch (error) {
                // Catch any unexpected errors during the modification processing loop
                console.error('An unexpected error occurred during modification:', error);
                this.showNotification('An unexpected error occurred.', 'error');
            }
        });

        // Delete modal setup
        const deleteItemBtn = document.querySelector('[data-action="remove"]');
        const deleteModal = document.getElementById('deleteItemModal');
        const deleteCloseModal = deleteModal.querySelector('.close-modal');
        const deleteCancelBtn = document.getElementById('cancelDelete');
        const deleteConfirmBtn = document.getElementById('confirmDelete');
        const deleteTableSelect = document.getElementById('deleteTableSelect');
        const deleteRowCount = document.getElementById('deleteRowCount');
        const deleteRowsContainer = document.getElementById('deleteRowsContainer');

        // Populate delete table select
        tables.forEach(table => {
            const option = document.createElement('option');
            option.value = table.name;
            option.textContent = table.name;
            deleteTableSelect.appendChild(option);
        });

        // Show delete modal
        deleteItemBtn.addEventListener('click', () => {
            deleteModal.classList.add('active');
            deleteRowsContainer.innerHTML = ''; // Clear existing rows
            updateDeleteRows();
        });

        // Handle delete row count change
        deleteRowCount.addEventListener('change', updateDeleteRows);

        // Handle delete table selection change
        deleteTableSelect.addEventListener('change', updateDeleteRows);

        function updateDeleteRows() {
            const selectedTable = deleteTableSelect.value;
            const count = parseInt(deleteRowCount.value) || 1;
            deleteRowsContainer.innerHTML = '';

            if (!selectedTable) {
                return;
            }

            const table = tables.find(t => t.name === selectedTable);
            if (!table) return;

            const primaryKey = table.attributes.find(attr => attr.isPrimary);
            if (!primaryKey) return;

            for (let i = 0; i < count; i++) {
                const rowGroup = document.createElement('div');
                rowGroup.className = 'row-group';
                rowGroup.innerHTML = `
                    <div class="form-group">
                        <label for="deleteItemId_${i}">${primaryKey.name.toUpperCase()} TO DELETE</label>
                        <input type="text" id="deleteItemId_${i}" class="futuristic-input" placeholder="Enter ${primaryKey.name}" data-field="${primaryKey.name}">
                    </div>
                `;
                deleteRowsContainer.appendChild(rowGroup);
            }
        }

        // Handle delete confirm button click
        deleteConfirmBtn.addEventListener('click', async () => {
            const selectedTable = deleteTableSelect.value;
            if (!selectedTable) {
                this.showNotification('Please select a table first', 'error');
                return;
            }

            const rows = deleteRowsContainer.querySelectorAll('.row-group');
            const ids = [];

            for (const row of rows) {
                const input = row.querySelector('input');
                const value = input.value.trim();
                if (value) {
                    ids.push(value);
                }
            }

            if (ids.length === 0) {
                this.showNotification('Please enter at least one ID to delete', 'error');
                return;
            }

            try {
                let successCount = 0;
                let errorCount = 0;
                let notFoundCount = 0;

                this.showNotification(`Attempting to delete ${ids.length} item(s) from ${selectedTable}...`, 'info');

                for (const id of ids) {
                    try {
                        const response = await fetch(`http://localhost:5000/delete-${selectedTable}/${id}`, {
                            method: 'DELETE'
                        });

                        const result = await response.json();

                        if (!response.ok) {
                            if (response.status === 404) {
                                console.error(`Item not found in ${selectedTable}:`, result.error);
                                notFoundCount++;
                            } else {
                                console.error(`Error deleting item from ${selectedTable}:`, result.error || response.statusText);
                                errorCount++;
                            }
                        } else {
                            successCount++;
                            console.log(`Successfully deleted item from ${selectedTable}:`, result.message);
                        }
                    } catch (error) {
                        console.error(`Network error while deleting item from ${selectedTable}:`, error);
                        errorCount++;
                    }
                }

                // Show appropriate notifications based on results
                if (successCount > 0) {
                    this.showNotification(`${successCount} item(s) deleted successfully from ${selectedTable}!`, 'success');
                }
                if (notFoundCount > 0) {
                    this.showNotification(`${notFoundCount} item(s) were not found in ${selectedTable}.`, 'warning');
                }
                if (errorCount > 0) {
                    this.showNotification(`${errorCount} item(s) failed to delete from ${selectedTable}. Check console for details.`, 'error');
                }

                if (successCount > 0) {
                    deleteModal.classList.remove('active');
                    this.refreshData();
                }
            } catch (error) {
                console.error('Error during delete operation:', error);
                this.showNotification('An error occurred during the delete operation', 'error');
            }
        });

        // Hide delete modal
        const hideDeleteModal = () => {
            deleteModal.classList.remove('active');
            deleteTableSelect.value = '';
            deleteRowCount.value = '1';
            deleteRowsContainer.innerHTML = '';
        };

        deleteCloseModal.addEventListener('click', hideDeleteModal);
        deleteCancelBtn.addEventListener('click', hideDeleteModal);
        deleteModal.addEventListener('click', (e) => {
            if (e.target === deleteModal) {
                hideDeleteModal();
            }
        });
    }

    /**
     * Handle primary actions (Add, Remove, Modify)
     * @param {string} action - The action to perform
     */
    handleAction(action) {
        const actionMap = {
            add: () => this.initiateAddItem(),
            remove: () => this.initiateRemoveItem(),
            modify: () => this.initiateModifyItem()
        };

        if (actionMap[action]) {
            actionMap[action]();
            this.logAction(action.toUpperCase());
        }
    }

    /**
     * Handle icon button actions
     * @param {HTMLElement} button - The clicked button
     */
    handleIconAction(button) {
        const title = button.getAttribute('title');
        
        switch(title) {
            case 'Refresh':
                this.refreshData();
                break;
            case 'Export':
                this.exportData();
                break;
            case 'Settings':
                this.openSettings();
                break;
        }
    }

    /**
     * Initiate add item process
     */
    initiateAddItem() {
        this.showNotification('ADD_ITEM_PROTOCOL_INITIATED', 'info');
        // This would connect to your backend API
        // Example: this.apiCall('POST', '/api/items', itemData);
    }

    /**
     * Initiate remove item process
     */
    initiateRemoveItem() {
        this.showNotification('REMOVE_ITEM_SEQUENCE_ACTIVATED', 'error');
        // This would connect to your backend API
        // Example: this.apiCall('DELETE', `/api/items/${itemId}`);
    }

    /**
     * Initiate modify item process
     */
    initiateModifyItem() {
        this.showNotification('MODIFY_ITEM_MATRIX_ENGAGED', 'success');
        // This would connect to your backend API
        // Example: this.apiCall('PUT', `/api/items/${itemId}`, itemData);
    }

    /**
     * Refresh data from backend
     */
    refreshData() {
        this.setLoadingState(true);
        this.showNotification('DATA_REFRESH_INITIATED', 'info');
        
        // Simulate API call - replace with actual backend integration
        setTimeout(() => {
            this.setLoadingState(false);
            this.showNotification('DATA_SYNCHRONIZATION_COMPLETE', 'success');
        }, 1500);
    }

    /**
     * Export inventory data
     */
    exportData() {
        this.showNotification('EXPORT_PROTOCOL_EXECUTING', 'info');
        
        // Simulate export process
        setTimeout(() => {
            this.showNotification('DATA_EXPORT_COMPLETE', 'success');
        }, 1000);
    }

    /**
     * Open settings panel
     */
    openSettings() {
        this.showNotification('SETTINGS_MATRIX_ACCESSED', 'info');
    }

    /**
     * Set loading state for the table
     * @param {boolean} loading - Loading state
     */
    setLoadingState(loading) {
        this.isLoading = loading;
        const spinner = document.querySelector('.loading-spinner');
        const placeholderText = document.querySelector('.placeholder-text');
        
        if (spinner && placeholderText) {
            if (loading) {
                spinner.style.display = 'block';
                placeholderText.querySelector('h4').textContent = 'Synchronizing Data Stream';
                placeholderText.querySelector('p').textContent = 'Processing inventory matrix updates...';
            } else {
                spinner.style.display = 'block';
                placeholderText.querySelector('h4').textContent = 'Awaiting Data Stream';
                placeholderText.querySelector('p').textContent = 'Connect backend service to initialize inventory matrix';
            }
        }
    }

    /**
     * Update the items table with new data
     * @param {Array} items - Array of inventory items
     */
    updateTable(items) {
        const tbody = document.getElementById('table-body');
        if (!tbody) return;

        if (!items || items.length === 0) {
            tbody.innerHTML = `
                <tr class="placeholder-row">
                    <td colspan="7" class="placeholder">
                        <div class="placeholder-content">
                            <div class="loading-spinner"></div>
                            <div class="placeholder-text">
                                <h4>No Items Found</h4>
                                <p>Add items to populate the inventory matrix</p>
                            </div>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        const rows = items.map(item => `
            <tr data-item-id="${item.id}">
                <td>${this.formatId(item.id)}</td>
                <td>${this.escapeHtml(item.name)}</td>
                <td>${this.formatNumber(item.quantity)}</td>
                <td>${this.formatCurrency(item.price)}</td>
                <td>${this.formatCurrency(item.quantity * item.price)}</td>
                <td>${this.getStatusBadge(item.quantity)}</td>
                <td>
                    <button class="icon-btn" title="Edit" data-action="edit" data-id="${item.id}">✎</button>
                    <button class="icon-btn" title="Delete" data-action="delete" data-id="${item.id}">🗑</button>
                </td>
            </tr>
        `).join('');

        tbody.innerHTML = rows;
        this.items = items;
    }

    /**
     * Format ID with leading zeros
     * @param {number} id - Item ID
     * @returns {string} Formatted ID
     */
    formatId(id) {
        return String(id).padStart(6, '0');
    }

    /**
     * Format number with commas
     * @param {number} num - Number to format
     * @returns {string} Formatted number
     */
    formatNumber(num) {
        return new Intl.NumberFormat().format(num);
    }

    /**
     * Format currency
     * @param {number} amount - Amount to format
     * @returns {string} Formatted currency
     */
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    }

    /**
     * Get status badge based on quantity
     * @param {number} quantity - Item quantity
     * @returns {string} Status badge HTML
     */
    getStatusBadge(quantity) {
        if (quantity === 0) {
            return '<span class="status-badge out-of-stock">OUT OF STOCK</span>';
        } else if (quantity < 10) {
            return '<span class="status-badge low-stock">LOW STOCK</span>';
        } else {
            return '<span class="status-badge in-stock">IN STOCK</span>';
        }
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Show notification
     * @param {string} message - Notification message
     * @param {string} type - Notification type (success, error, info)
     */
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <strong>${message}</strong>
                <div class="notification-timestamp">${new Date().toLocaleTimeString()}</div>
            </div>
        `;

        const container = document.getElementById('notifications');
        container.appendChild(notification);

        // Auto remove after 4 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 4000);

        // Add slide out animation
        if (!document.querySelector('#slideout-keyframes')) {
            const style = document.createElement('style');
            style.id = 'slideout-keyframes';
            style.textContent = `
                @keyframes slideOut {
                    to {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * Update the clock display
     */
    updateClock() {
        const timeElement = document.getElementById('current-time');
        if (timeElement) {
            const now = new Date();
            const timeString = now.toLocaleTimeString('en-US', {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            timeElement.textContent = timeString;
        }
    }

    /**
     * Start the clock interval
     */
    startClockInterval() {
        this.clockInterval = setInterval(() => {
            this.updateClock();
        }, 1000);
    }

    /**
     * Log action to console
     * @param {string} action - Action performed
     */
    logAction(action) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] NEXUS_INVENTORY: ${action} executed`);
    }

    /**
     * API call wrapper (to be implemented with actual backend)
     * @param {string} method - HTTP method
     * @param {string} endpoint - API endpoint
     * @param {Object} data - Request data
     * @returns {Promise} API response
     */
    async apiCall(method, endpoint, data = null) {
        try {
            const options = {
                method,
                headers: {
                    'Content-Type': 'application/json'
                }
            };
            if (data) {
                options.body = JSON.stringify(data);
            }
            const response = await fetch(endpoint, options);

            // Check if the response is OK before attempting to parse as JSON
            if (!response.ok) {
                const errorText = await response.text(); // Read response body as text
                throw new Error(`API call failed with status ${response.status}: ${errorText}`);
            }

            // Check content type before attempting to parse as JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const textResponse = await response.text();
                console.warn('Received non-JSON response from API:', textResponse);
                // Depending on the expected behavior, you might throw an error here,
                // return a specific value, or try to parse it differently.
                // For now, we'll log and re-throw a generic error or handle as needed.
                throw new Error('API response was not in JSON format.');
            }
            
            // Debugging: Check the type of response.json
            console.log('Type of response.json:', typeof response.json);

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('API call failed:', error);
            console.error('Details:', error); // Log the full error object
            throw error; // Re-throw the enhanced error
        }
    }
}

// Initialize the inventory manager when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.inventoryManager = new InventoryManager();
});