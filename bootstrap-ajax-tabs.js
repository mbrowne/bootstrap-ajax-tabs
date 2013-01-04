(function ($) {

  "use strict"; // jshint ;_;

	//To change these defaults, call $('[data-toggle="ajax-tab"]').ajaxTab('option', 'key', 'new value')
	var defaults = {
			//cacheResponse: Whether to cache the HTML retrieved for tab content, in case the same tab is clicked again
			// Not to be confused with the cache option passed to $.ajax, which only works if the headers from the server
			//	allow caching. This is in-memory caching of the HTML returned
			cacheResponse: true
		},
		requestPendingFor = [];
	
	
	var Tab = $.fn.tab.Constructor

	//Inherit from base Tab class
	function AjaxTab(element) {
		Tab.call(this, element);
		this.showEventBound = false;
		this.options = $.extend(true, {}, defaults);
	}
	AjaxTab.prototype = new Tab();
	
	$.extend(AjaxTab.prototype, {
		constructor: AjaxTab,
		
		option: function(key, val) {
			this.options[key] = val;
		},
		
		show: function() {			
			//This code is here in case this method is called directly on an element that didn't have data-toggle set to ajax-tab or ajax-pill
			if (!this.showEventBound) {
				$(this.element).on('show', AjaxTab.onShowHandler);
				this.showEventBound = true;
			}	
			Tab.prototype.show.call(this);
		},
		
		loadAjaxContent: function($target, url, $ul) {
			var self = this
			  , $this = this.element	
			  , previousTab = $ul.find('.active:last a')[0];
			
			var activateTab = function() {
				self.activate($this.parent('li'), $ul)
				self.activate($target, $target.parent(), function () {
					$this.trigger({
						type: 'shown'
					, relatedTarget: previousTab
					})
				});
			}
			
			if (self.options.cacheResponse) {				
				if ($target.html() != '') {
					activateTab()
					return					
				}
			}
			
			//prevent simultaneous AJAX requests for the same URL
			if (requestPendingFor[url]) return
			requestPendingFor[url] = true
			
			$.get(url)
				.then(function(html) {
					$target.html(html)
				})
				.fail(function(jqXHR) {
					$this.trigger('tabAjaxError', arguments)
					
					//By default (if no error handler specified), display the 404 page if we got one
					var eventData = $._data($this[0], 'events') || $this.data('events')					
					if (!eventData.tabAjaxError) {
						$target.html(jqXHR.responseText)
					}
				})
				.always(function() {
					activateTab()
					requestPendingFor[url] = false
				})
		}
	});
	
	//This method is declared here rather than on the prototype to avoid confusion, because its "this" variable points to the element
	//and not the AjaxTab instance
	AjaxTab.onShowHandler = function(e) {
		var $this = $(this)
		  , selector = $this.attr('data-target')
		  , $target
		  , $ul = $this.closest('ul:not(.dropdown-menu)');
			 
		e.preventDefault();
			 
		if (selector) $target = $(selector);
		else {
			//container div for tab content
			var $tabContentContainer = $( $ul.attr('data-tab-content') ),
				 $topLevelTabLi,
			    tabIdx; // = $ul.children().index( $this.parent() );
			
			if ($this.closest('ul').hasClass('dropdown-menu')) {
				$topLevelTabLi = $this.closest('li:not(.dropdown)')
			}
			else $topLevelTabLi = $this.parent()
			
			tabIdx = $ul.children().index( $topLevelTabLi )
			$target = $tabContentContainer.children().eq(tabIdx)
		}
		
		$this.data('ajaxTab').loadAjaxContent($target, $this.attr('href'), $ul);
	}


  /* AJAXTAB PLUGIN DEFINITION
	* ========================= */

	$.fn.ajaxTab = function ( method ) {
		var args = arguments;
		return this.each(function () {
			var $this = $(this)
				, ajaxTab = $this.data('ajaxTab')
				
			if (!ajaxTab) $this.data('ajaxTab', (ajaxTab = new AjaxTab(this)));
			if (typeof method == 'string') ajaxTab[method].apply(ajaxTab, Array.prototype.slice.call(args, 1));
		});
	}
	
	$.fn.ajaxTab.Constructor = AjaxTab;
	
	/* AJAXTAB DATA-API
		* ================ */
	
	var selector = '[data-toggle="ajax-tab"], [data-toggle="ajax-pill"]';
	$(document)
		.on('click.ajaxTab.data-api', selector, function (e) {
			e.preventDefault()
			var $this = $(this)
			//We set a flag to designate that the 'show' event has been bound to AjaxTab.onShowHandler 
			var ajaxTab = $this.ajaxTab().data('ajaxTab');
			ajaxTab.showEventBound = true;
			ajaxTab.show();
		})
		.on('show', selector, AjaxTab.onShowHandler)
		//.on('tabAjaxError', function() {return true})
	
	$().ready(function() {
		//Show initial content for the tab with the "active" class, or the first tab if no tabs have the "active" class
		//
		//NOTE: If you have created separate elements for each tab inside your tab-content container,
		//and they have an "active" class, it will be ignored.
		//Set the "active" class on the link to that tab instead.
		//

		$('.nav-tabs, .nav-pills').each(function() {
			//First, create content divs if they don't already exist
			//
			//This approach (separate div for each tab pane) should theoretically allow for crossfades,
			//although they're not currently implemented.
			//The cacheResponse option also depends on there being a separate div for each tab pane
			var $tabContentContainer = $($(this).attr('data-tab-content'))
			if ($tabContentContainer.children().length == 0) {
				var $contentTpl = $('<div class="tab-pane fade" />');
				for (var i=0; i < $(this).children().length; i++) {
					$tabContentContainer.append($contentTpl.clone());
				}
			}

			var $activeTab = $(this).find('li .active');
			if ($activeTab.length == 0) $activeTab = $(this).find(':first a');

			var dataToggle = $activeTab.attr('data-toggle');
			if (dataToggle=='ajax-tab' || dataToggle=='ajax-pill') {
				$activeTab.ajaxTab().data('ajaxTab').showEventBound = true;
			}
			$activeTab.ajaxTab('show');
		})
	});

}(window.jQuery));