/*==============================================================================*/
/* Add service user */
/* Delete service user */
/*==============================================================================*/

module.exports = {
	'test case': function (client) {
		return client
			.url(`${TEST_RUNNER.CONFIG.baseUrl}/#/login`)
			.waitForElementVisible("form[name=form] input[name='username']", DEFAULT_TIMEOUT)
			.customClick("form[name=form] input[name='username']")
			.waitForElementVisible("input[name='username']", DEFAULT_TIMEOUT)
			.setValue("input[name='username']", TEST_RUNNER.CONFIG.username)
			.waitForElementVisible("form[name=form] input[name='password']", DEFAULT_TIMEOUT)
			.customClick("form[name=form] input[name='password']")
			.waitForElementVisible("input[name='password']", DEFAULT_TIMEOUT)
			.setValue("input[name='password']", TEST_RUNNER.CONFIG.password)
	)
		.waitForElementVisible("form[name=form] input[type=submit][value='Login']", DEFAULT_TIMEOUT)
		.customClick("form[name=form] input[type=submit][value='Login']")
		/* submit form */
		.waitForElementVisible(".mdtTable.md-whiteframe-z1._md.layout-column ng-include .tbodyTrRow.ng-scope:nth-child(4) .column.ng-scope.ng-isolate-scope.leftAlignedColumn:nth-child(3) span", DEFAULT_TIMEOUT)
		.customClick(".mdtTable.md-whiteframe-z1._md.layout-column ng-include .tbodyTrRow.ng-scope:nth-child(4) .column.ng-scope.ng-isolate-scope.leftAlignedColumn:nth-child(3) span")
		.waitForElementVisible(".mdtTable.md-whiteframe-z1._md.layout-column ng-include .tbodyTrRow.ng-scope:nth-child(1) .column.ng-scope.ng-isolate-scope.leftAlignedColumn:nth-child(3)", DEFAULT_TIMEOUT)
		.customClick(".mdtTable.md-whiteframe-z1._md.layout-column ng-include .tbodyTrRow.ng-scope:nth-child(1) .column.ng-scope.ng-isolate-scope.leftAlignedColumn:nth-child(3)")
		.useXpath()
		.waitForElementVisible("//a[normalize-space(text())='Service Users']", DEFAULT_TIMEOUT)
		.customClick("//a[normalize-space(text())='Service Users']")
		.useCss()
		.useXpath()
		.waitForElementVisible("//a[normalize-space(text())='Add Service User']", DEFAULT_TIMEOUT)
		.customClick("//a[normalize-space(text())='Add Service User']")
		.useCss()
		.waitForElementVisible(".ui.modal.ng-isolate-scope.transition.visible.animating.fade.out .x-btn.x-unselectable.x-box-item.x-toolbar-item.x-btn-default-small.ng-scope:nth-child(1) .x-btn-button.x-btn-button-default-small.x-btn-text.x-btn-button-center", DEFAULT_TIMEOUT)
		.customClick(".ui.modal.ng-isolate-scope.transition.visible.animating.fade.out .x-btn.x-unselectable.x-box-item.x-toolbar-item.x-btn-default-small.ng-scope:nth-child(1) .x-btn-button.x-btn-button-default-small.x-btn-text.x-btn-button-center")
		.waitForElementVisible(".ui.left.top.pointing.inline.dropdown.active > .ng-binding", DEFAULT_TIMEOUT)
		.customClick(".ui.left.top.pointing.inline.dropdown.active > .ng-binding")
		.useXpath()
		.waitForElementVisible("//a[normalize-space(text())='Logout']", DEFAULT_TIMEOUT)
		.customClick("//a[normalize-space(text())='Logout']")
		.useCss()

}
}
;