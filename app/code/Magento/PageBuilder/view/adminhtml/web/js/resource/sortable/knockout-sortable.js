/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

/*eslint-disable vars-on-top, strict, max-len, max-depth */

define([
    "knockout", "jquery", "underscore", "Magento_Ui/js/lib/core/events", "Magento_PageBuilder/js/content-type", "jquery/ui"],
    function(ko, jQuery, _, events) {

    /**
     * Retrieve the view model for an element
     *
     * @param ui
     * @returns {{}}
     */
    function getViewModelFromUi(ui) {
        return ko.dataFor(ui.item[0]) || {};
    }

    // Listen for the dragged component from the event bus
    var draggedComponent;

    events.on("drag:start", function (args) {
        draggedComponent = args.component;
    });
    events.on("drag:stop", function () {
        draggedComponent = false;
    });

    var Sortable = {
        defaults: {
            tolerance: 'pointer',
            cursor: '-webkit-grabbing',
            connectWith: '.pagebuilder-sortable',
            helper: function (event, element) {
                return element.css('opacity', 0.5);
            },
            appendTo: document.body,
            placeholder: {
                element: function (clone) {
                    if (clone.hasClass('pagebuilder-draggable-content-type')) {
                        return jQuery('<div />').addClass('pagebuilder-draggable-content-type pagebuilder-placeholder').append(clone.html());
                    }
                    return jQuery('<div />').addClass('pagebuilder-placeholder-sortable');
                },
                update: function () {
                    return;
                }
            },
            sortableClass: 'pagebuilder-sortable'
        },

        /**
         * Init draggable on the elements
         *
         * @param element
         * @param extendedConfig
         * @returns {*}
         */
        init: function (element, extendedConfig) {
            var config = this._getConfig(extendedConfig);

            // Init sortable on our element with necessary event handlers
            element
                .addClass(config.sortableClass)
                .sortable(config)
                .on('sortstart', this.onSortStart)
                .on('sortstop', this.onSortStop)
                .on('sortupdate', this.onSortUpdate)
                .on('sortchange', this.onSortChange)
                .on('sortbeforestop', this.onSortBeforeStop)
                .on('sortreceive', this.onSortReceive);
        },

        /**
         * Return the draggable config
         *
         * @param extendedConfig
         * @returns {Sortable.defaults|{scroll, revert, revertDuration, helper, zIndex}}
         * @private
         */
        _getConfig: function (extendedConfig) {
            var config = this.defaults;

            // Extend the config with any custom configuration
            if (extendedConfig) {
                if (typeof extendedConfig === 'function') {
                    extendedConfig = extendedConfig();
                }
                config = ko.utils.extend(config, extendedConfig);
            }

            return config;
        },

        /**
         * Handle sort start
         *
         * @param event
         * @param ui
         */
        onSortStart: function (event, ui) {
            var contentType = getViewModelFromUi(ui);

            // Store the original parent for use in the update call
            contentType.originalParent = contentType.parent || false;

            // ui.helper.data('sorting') is appended to the helper of sorted items
            if (contentType && jQuery(ui.helper).data('sorting')) {
                var eventData = {
                    contentType: contentType,
                    event: event,
                    helper: ui.helper,
                    placeholder: ui.placeholder,
                    originalEle: ui.item,
                    stageId: contentType.stageId
                };

                // ui.position to ensure we're only reacting to sorting events
                events.trigger("contentType:sortStart", eventData);
            }
        },

        /**
         * Handle sort stop
         *
         * @param event
         * @param ui
         */
        onSortStop: function (event, ui) {
            // Always remove the sorting original class from an element
            ui.item.removeClass('pagebuilder-sorting-original');

            var contentType = getViewModelFromUi(ui);

            // ui.helper.data('sorting') is appended to the helper of sorted items
            if (contentType && jQuery(ui.helper).data('sorting')) {
                var eventData = {
                    contentType: contentType,
                    event: event,
                    helper: ui.helper,
                    placeholder: ui.placeholder,
                    originalEle: ui.item,
                    stageId: contentType.stageId
                };

                // ui.position to ensure we're only reacting to sorting events
                events.trigger("contentType:sortStop", eventData);
            }

            ui.item.css('opacity', 1);
        },

        /**
         * Handle a sort update event, this occurs when a sortable item is sorted
         *
         * @param event
         * @param ui
         */
        onSortUpdate: function (event, ui) {
            var contentTypeEl = ui.item,
                newParentEl = contentTypeEl.parent()[0],
                newIndex = contentTypeEl.index();

            if (contentTypeEl && newParentEl && newParentEl === this) {
                var contentType = ko.dataFor(contentTypeEl[0]),
                    newParent = ko.dataFor(newParentEl);

                // @todo to be refactored under MAGETWO-86953
                if ((contentType.config.name === 'column-group' || contentType.config.name === 'column') &&
                    jQuery(event.currentTarget).hasClass('column-container')
                ) {
                    return;
                }

                var parentContainerName = ko.dataFor(jQuery(event.target)[0]).config.name,
                    allowedParents = getViewModelFromUi(ui).config.allowed_parents;

                if (parentContainerName && Array.isArray(allowedParents)) {
                    if (allowedParents.indexOf(parentContainerName) === -1) {
                        jQuery(this).sortable("cancel");
                        jQuery(ui.item).remove();

                        // Force refresh of the parent
                        var data = getViewModelFromUi(ui).parent.children().slice(0);

                        getViewModelFromUi(ui).parent.children([]);
                        getViewModelFromUi(ui).parent.children(data);
                        return;
                    }
                }

                // Detect if we're sorting items within the stage
                if (typeof newParent.stageId === 'function' && newParent.stageId()) {
                    newParent = newParent.stage;
                }

                // Fire our events on the various parents of the operation
                if (contentType !== newParent) {
                    ui.item.remove();
                    if (contentType.originalParent === newParent) {
                        events.trigger("contentType:sorted", {
                            parent: newParent,
                            contentType: contentType,
                            index: newIndex,
                            stageId: contentType.stageId
                        });
                    } else {
                        contentType.originalParent.removeChild(contentType);
                        events.trigger("contentType:instanceDropped", {
                            parent: newParent,
                            contentTypeInstance: contentType,
                            index: newIndex,
                            stageId: contentType.stageId
                        });
                    }

                    contentType.originalParent = false;
                    jQuery(this).sortable('refresh');
                }
            }
        },

        /**
         * Hide or show the placeholder based on the elements allowed parents
         *
         * @param event
         * @param ui
         * @returns {*}
         */
        onSortChange: function (event, ui) {
            var parentContainerName = ko.dataFor(jQuery(event.target)[0]).config.name,
                currentInstance = getViewModelFromUi(ui);

            // If the registry contains a reference to the drag element view model use that instead
            if (draggedComponent) {
                currentInstance = draggedComponent;
            }

            var allowedParents = currentInstance.config.allowed_parents;

            // Verify if the currently dragged content type is accepted by the hovered parent
            if (parentContainerName && Array.isArray(allowedParents)) {
                if (allowedParents.indexOf(parentContainerName) === -1) {
                    ui.placeholder.hide();
                } else {
                    ui.placeholder.show();
                }
            }
        },

        /**
         * Handle capturing the dragged item just before the sorting stops
         *
         * @param event
         * @param ui
         */
        onSortBeforeStop: function (event, ui) {
            this.draggedItem = ui.item;
        },

        /**
         * Handle recieving a content type from the panel
         *
         * @param event
         * @param ui
         */
        onSortReceive: function (event, ui) {
            if (jQuery(event.target)[0] === this) {
                var contentType = getViewModelFromUi(ui),
                    target = ko.dataFor(jQuery(event.target)[0]);

                // Don't run sortable when dropping on a placeholder
                // @todo to be refactored under MAGETWO-86953
                if (contentType.config.name === "column" &&
                    jQuery(event.srcElement).parents('.ui-droppable').length > 0
                ) {
                    return;
                }

                if (contentType.droppable) {
                    event.stopPropagation();
                    // Emit the content type Dropped event upon the target
                    // Detect if the target is the parent UI component, if so swap the target to the stage
                    var stageId = typeof target.parent.preview !== "undefined" ? target.parent.stageId : target.id;
                    target = typeof target.parent.preview !== "undefined" ? target.parent : target;
                    events.trigger("contentType:dropped", {
                        parent: target,
                        stageId: stageId,
                        contentType: contentType,
                        index: this.draggedItem.index(),
                    });
                    this.draggedItem.remove();
                }
            } else if (!ui.helper && ui.item) {
                _.defer(function () {
                    jQuery(ui.item).remove();
                });
            }
        }
    };

    // Create a new sortable Knockout binding
    ko.bindingHandlers.sortable = {

        /**
         * Init the draggable binding on an element
         *
         * @param element
         * @param valueAccessor
         * @param allBindingsAccessor
         * @param data
         * @param context
         */
        init: function(element, valueAccessor) {
            // Initialize draggable on all children of the element
            Sortable.init(jQuery(element), valueAccessor);
        }

    };
});
