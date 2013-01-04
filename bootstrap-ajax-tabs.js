//Plugin for tabs to allow content to be loaded via AJAX
//
//Also might be of interest - in consideration for development:
//A plugin to allow to link to a particular tab.
//In the meantime, see:
//http://stackoverflow.com/questions/7862233/twitter-bootstrap-tabs-go-to-specific-tab-on-page-reload

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
		
		//@param isFirstShowOfDefaultTab bool	Whether this is the first time the initially-visible tab is being displayed
		show: function(isFirstShowOfDefaultTab) {			
			//This code is here in case this method is called directly on an element that didn't have data-toggle set to ajax-tab or ajax-pill
			if (!this.showEventBound) {
				$(this.element).on('show', AjaxTab.onShowHandler);
				this.showEventBound = true;
			}
			this.isFirstShowOfDefaultTab = isFirstShowOfDefaultTab
			
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
				
				if (self.isFirstShowOfDefaultTab) {
					$target.addClass('in')
				}
			}
			
			if (url[0]=='#') {
				var selector = url;
				//If the target ID is different than the ID pointed to by the href,
				//update the HTML of the target to equal the HTML of the element indicated by the href.
				//This behavior is different from Bootstrap's base tabs implementation; we do it so
				//the behavior is consistent regardless of whether the link is an ajax link or not
				if (selector.indexOf($target[0].id) != 1) {
					$target.html( $(selector).html() )
				}
				activateTab()
				return
			}
			if (self.options.cacheResponse && !$target.data('errorLoading')) {
				var trimmedHtml = $target.html().trim();
				//make sure there's some real HTML, not just comments
				if (trimmedHtml != '' && trimmedHtml.indexOf('<!--')!=0 )  {
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
					if (!eventData || !eventData.tabAjaxError) {
						$target.html(jqXHR.responseText)
						$target.data('errorLoading', true)
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
		  , url
		  , selector = $this.attr('data-target')
		  , $target
		  , $ul = $this.closest('ul:not(.dropdown-menu)');
			 
		e.preventDefault();
			 
		url = $this.attr('href')
			 
		if (selector) {
			$target = $(selector);
		}
		else {			
			if (url[0]=='#') {
				selector = url.replace(/.*(?=#[^\s]*$)/, '') //strip for ie7
				$target = $(selector)
			}
			
			//If the target hasn't been found so far, make it the pane with the index corresponding to the tab index
			if (!$target || $target.length==0) {
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
		}
		
		$this.data('ajaxTab').loadAjaxContent($target, url, $ul);
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
		.on('show', selector, AjaxTab.onShowHandler);
	
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
			var $tabContentContainer = $($(this).attr('data-tab-content')),
			    numPanesInHtml = $tabContentContainer.children().length,
				 defaultTabPaneAlreadyInHtml = numPanesInHtml==1
				 
			if (numPanesInHtml < 2) {
				var $contentTpl = $('<div class="tab-pane fade" />');
				//If there's already a div for the default tab, don't create a div for it
				var i = defaultTabPaneAlreadyInHtml ? 1: 0
				for (i; i < $(this).children().length; i++) {
					var $content = $contentTpl.clone()
					if (i==0) $content.addClass('active')
					$tabContentContainer.append($content);
				}
			}

			var $activeTab = $(this).find('li .active');
			if ($activeTab.length == 0) $activeTab = $(this).find(':first a');

			var dataToggle = $activeTab.attr('data-toggle');
			if (dataToggle=='ajax-tab' || dataToggle=='ajax-pill') {
				$activeTab.ajaxTab().data('ajaxTab').showEventBound = true;
			}
			$activeTab.ajaxTab('show', !defaultTabPaneAlreadyInHtml);
		})
	});

}(window.jQuery));