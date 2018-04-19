/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

import ko from "knockout";
import $t from "mage/translate";
import ContentTypeConfigInterface from "../../../content-type-config.d";
import ContentTypeInterface from "../../../content-type.d";
import ObservableUpdater from "../../../observable-updater";
import Preview from "../../../preview";
import {fromHex} from "../../../utils/color-converter";
import {getImageUrl} from "../../../utils/directives";
import {percentToDecimal} from "../../../utils/number-converter";
import {StyleAttributeMapperResult} from "../../format/style-attribute-mapper";
import {Options} from "../../stage/structural/options";
import {Option} from "../../stage/structural/options/option";
import {OptionInterface} from "../../stage/structural/options/option.d";

export default class Slide extends Preview {
    private showOverlayHover: KnockoutObservable<boolean> = ko.observable(false);
    private showButtonHover: KnockoutObservable<boolean> =  ko.observable(false);
    private buttonPlaceholder: string = $t("Edit Button Text");

    /**
     * @param {ContentTypeInterface} parent
     * @param {ContentTypeConfigInterface} config
     * @param {ObservableUpdater} observableUpdater
     */
    constructor(
        parent: ContentTypeInterface,
        config: ContentTypeConfigInterface,
        observableUpdater: ObservableUpdater,
    ) {
        super(parent, config, observableUpdater);
        const slider = this.parent.parent;
        this.displayLabel($t("Slide") + (slider.children().indexOf(this.parent) + 1));
        slider.children.subscribe((children) => {
            const index = children.indexOf(this.parent);
            this.displayLabel($t("Slide") + (index + 1));
        });
    }
    /**
     * Get the slide wrapper attributes for the preview
     *
     * @returns {any}
     */
    public getBackgroundStyles() {
        const data = this.previewData;
        let backgroundImage: string = "none";
        if (data.background_image() && data.background_image() !== "" &&
            data.background_image() !== undefined &&
            data.background_image()[0] !== undefined) {
            backgroundImage = "url(" + data.background_image()[0].url + ")";
        }
        return {
            backgroundImage,
            backgroundSize: data.background_size(),
            minHeight: data.min_height() ? data.min_height() + "px" : "300px",
            overflow: "hidden",
            paddingBottom: "",
            paddingLeft: "",
            paddingRight: "",
            paddingTop: "",
        };
    }

    /**
     * Get the slide overlay attributes for the preview
     *
     * @returns {any}
     */
    public getOverlayStyles() {
        const data = this.previewData.margins_and_padding();
        const paddingTop = data.padding.top || "0";
        const paddingRight = data.padding.right || "0";
        const paddingBottom = data.padding.bottom || "0";
        const paddingLeft = data.padding.left || "0";
        return {
            backgroundColor: this.getOverlayColorStyle().backgroundColor,
            minHeight: data.min_height ? data.min_height + "px" : "300px",
            paddingBottom: paddingBottom + "px",
            paddingLeft: paddingLeft + "px",
            paddingRight: paddingRight + "px",
            paddingTop: paddingTop + "px",
        };
    }

    /**
     * Get the overlay background style for the preview
     *
     * @returns {any}
     */
    public getOverlayColorStyle() {
        const data = this.previewData;
        let overlayColor: string = "transparent";
        if (data.show_overlay() === "always" || this.showOverlayHover()) {
            if (data.overlay_color() !== "" && data.overlay_color() !== undefined) {
                const colors = data.overlay_color();
                const alpha = percentToDecimal(data.overlay_transparency());
                overlayColor = fromHex(colors, alpha);
            } else {
                overlayColor = "transparent";
            }
        }
        return {
            backgroundColor: overlayColor,
        };
    }

    /**
     * Is there content in the WYSIWYG?
     *
     * @returns {boolean}
     */
    public isContentEmpty(): boolean {
        const data = this.previewData.content();
        return data === "" || data === undefined;
    }

    /**
     * Get the content for the preview
     *
     * @returns {any}
     */
    public getContentHtml() {
        if (this.isContentEmpty()) {
            return $t("Edit slide text");
        } else {
            return $t(this.previewData.content());
        }
    }

    /**
     * Get the button text for the preview
     *
     * @returns {any}
     */
    public getButtonStyles() {
        const buttonStyle = {
            opacity : "0",
            visibility : "hidden",
        };
        if (this.previewData.show_button() === "always" || this.showButtonHover()) {
            buttonStyle.opacity = "1";
            buttonStyle.visibility = "visible";
        }
        return buttonStyle;
    }

    /**
     * Set state based on overlay mouseover event for the preview
     */
    public onMouseOverWrapper() {
        if (this.previewData.show_overlay() === "on_hover") {
            this.showOverlayHover(true);

        }
        if (this.previewData.show_button() === "on_hover") {
            this.showButtonHover(true);
        }
    }

    /**
     * Set state based on overlay mouseout event for the preview
     */
    public onMouseOutWrapper() {
        if (this.previewData.show_overlay() === "on_hover") {
            this.showOverlayHover(false);
        }
        if (this.previewData.show_button() === "on_hover") {
            this.showButtonHover(false);
        }
    }

    /**
     * Extract data values our of observable functions
     * Update the style attribute mapper converts images to directives, override it to include the correct URL
     *
     * @param {StyleAttributeMapperResult} styles
     * @returns {StyleAttributeMapperResult}
     */

    /**
     * Get the options instance
     *
     * @returns {Options}
     */
    public getOptions(): Options {
        const options = super.getOptions();
        options.removeOption("move");
        return options;
    }

    /**
     * Get the slide wrapper styles for the storefront
     *
     * @returns {object}
     */
    public getSlideStyles(type: string): {} {
        const data = this.previewData;
        const style = _.clone(this.getStyle());

        let backgroundImage: any = "";
        if (type === "image") {
            backgroundImage = this.getImage() ? this.getStyle().backgroundImage : "none";
        }

        if (type === "mobileImage") {
            if (this.getMobileImage()) {
                backgroundImage = this.getStyle().mobileImage;
            } else {
                if (this.getImage()) {
                    backgroundImage = this.getStyle().backgroundImage;
                } else {
                    backgroundImage = "none";
                }
            }
        }

        return Object.assign(
            style,
            {
                backgroundImage,
                backgroundSize: data.background_size(),
                border: "",
                borderColor: "",
                borderRadius: "",
                borderWidth: "",
                marginBottom: "",
                marginLeft: "",
                marginRight: "",
                marginTop: "",
                paddingBottom: "",
                paddingLeft: "",
                paddingRight: "",
                paddingTop: "",
            },
        );
    }

    /**
     * Get the slide overlay attributes for the storefront
     *
     * @returns {object}
     */
    public getOverlayAttributes(): {} {
        const data = this.previewData;
        let overlayColorAttr: string = "transparent";
        if (data.show_overlay() !== "never_show") {
            if (data.overlay_color() !== "" && data.overlay_color() !== undefined) {
                overlayColorAttr = fromHex(data.overlay_color(), percentToDecimal(data.overlay_transparency()));
            }
        }
        return {
            "data-overlay-color" : overlayColorAttr,
        };
    }

    /**
     * Return an array of options
     *
     * @returns {Array<Option>}
     */
    public retrieveOptions(): OptionInterface[] {
        const options = super.retrieveOptions();
        const newOptions = options.filter((option) => {
            return (option.code !== "remove");
        });
        const removeClasses = ["remove-structural"];
        let removeFn = this.onOptionRemove;
        if (this.parent.parent.children().length <= 1) {
            removeFn = () => { return; };
            removeClasses.push("disabled");
        }
        newOptions.push(new Option(
            this,
            "remove",
            "<i class='icon-admin-pagebuilder-remove'></i>",
            $t("Remove"),
            removeFn,
            removeClasses,
            100,
        ));
        return newOptions;
    }
    protected afterStyleMapped(styles: StyleAttributeMapperResult): StyleAttributeMapperResult {
        // Extract data values our of observable functions
        // The style attribute mapper converts images to directives, override it to include the correct URL
        const data = this.previewData;
        if (data.background_image() && typeof data.background_image()[0] === "object") {
            styles.backgroundImage = "url(" + data.background_image()[0].url + ")";
        }
        if (data.mobile_image()
            && data.mobile_image() !== ""
            && typeof data.mobile_image()[0] === "object"
        ) {
            styles.mobileImage = "url(" + data.mobile_image()[0].url + ")";
        }
        return styles;
    }
}
