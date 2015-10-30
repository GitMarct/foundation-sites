/**
 * Orbit module.
 * @module foundation.orbit
 * @requires foundation.util.keyboard
 * @requires foundation.util.animationFrame
 * @requires foundation.util.motion
 * @requires foundation.util.timer
 */
!function($, Foundation){
  'use strict';
  function Orbit(element){
    this.$element = element;
    this.options = $.extend({}, Orbit.defaults, this.$element.data());

    this._init();

    Foundation.registerPlugin(this);
    // this.$element.trigger('init.zf.orbit');
  }
  Orbit.defaults = {
    bullets: true,
    navButtons: true,
    animInFromRight: 'slideInRight',
    animOutToRight: 'slideOutRight',
    animInFromLeft: 'slideInLeft',
    animOutToLeft: 'slideOutLeft',
    autoPlay: true,
    timerDelay: 5000,
    infiniteWrap: true,
    swipe: true,
    pauseOnHover: true,
    accessible: true,
    containerClass: 'orbit-container',
    slideClass: 'orbit-slide',
    boxOfBullets: 'orbit-bullets',
    nextClass: 'orbit-next',
    prevClass: 'orbit-previous'
  };
  Orbit.prototype._init = function(){
    this.$wrapper = this.$element.find('.' + this.options.containerClass);
    this.$slides = this.$element.find('.' + this.options.slideClass);

    this._prepareForOrbit();//hehe

    if(this.options.bullets){
      this.loadBullets();
    }

    this._events();

    if(this.options.autoPlay){
      this.geoSync();
    }
    if (this.options.accessible) { // allow wrapper to be focusable to enable arrow navigation
      this.$wrapper.attr('tabindex', 0);
    }
  };
  Orbit.prototype.loadBullets = function(){
    this.$bullets = this.$element.find('.' + this.options.boxOfBullets).find('button');
  };
  Orbit.prototype.geoSync = function(){
    var _this = this;
    this.timer = new Foundation.NanuNanu(
                      this.$element,
                      {duration: this.options.timerDelay},
                      function(){
                        _this.changeSlide(true);
    });
    this.timer.start();
  };
  Orbit.prototype._prepareForOrbit = function(){
    var _this = this;
    this.setWrapperHeight(function(max){
      _this.setSlideHeight(max);
    });
  }
  Orbit.prototype.setWrapperHeight = function(cb){//rewrite this to `for` loop
    var max = 0, temp, counter = 0;

    this.$slides.each(function(){
      temp = this.getBoundingClientRect().height;

      if(counter){//if not the first slide, set css position and display property
        $(this).css({'position': 'relative', 'display': 'none'});
      }
      max = temp > max ? temp : max;
      counter++;
    });

    if(counter === this.$slides.length){
      this.$wrapper.css({'height': max});//only change the wrapper height property once.
      cb(max);//fire callback with max height dimension.
    }
  };
  Orbit.prototype.setSlideHeight = function(height){
    this.$slides.each(function(){
      $(this).css('max-height', height);
    });
  };
  Orbit.prototype._events = function(){
    var _this = this;

    //***************************************
    //**currently using jQuery Mobile event**
    //**see comments below, needs to change**
    //***************************************
    if(this.options.swipe){
      this.$slides.off('swipeleft.zf.orbit swiperight.zf.orbit')
      .on('swipeleft.zf.orbit', function(e){
        e.preventDefault();
        _this.timer.restart();
        _this.changeSlide(true);
      }).on('swiperight.zf.orbit', function(e){
        e.preventDefault();
        _this.timer.restart();
        _this.changeSlide(false);
      });
    }
    //***************************************

    if(this.options.autoPlay){
      this.$slides.on('click.zf.orbit', function(){
        _this.$element.data('clickedOn', _this.$element.data('clickedOn') ? false : true);
        _this.timer[_this.$element.data('clickedOn') ? 'pause' : 'start']();
      });
      if(this.options.pauseOnHover){
        this.$element.on('mouseenter.zf.orbit', function(){
          _this.timer.pause();
        }).on('mouseleave.zf.orbit', function(){
          if(!_this.$element.data('clickedOn')){
            _this.timer.start();
          }
        });
      }
    }

    if(this.options.navButtons){
      var $controls = this.$element.find('.' + this.options.nextClass + ', .' + this.options.prevClass);
      if(this.options.accessible){
        $controls.attr('tabindex', 0);
        //also need to handle enter/return and spacebar key presses
      }
      $controls.on('click.zf.orbit touchend.zf.orbit', function(){
        if($(this).hasClass(_this.options.nextClass)){
          _this.changeSlide(true);
          _this.timer.restart();
        }else{
          _this.changeSlide(false);
          _this.timer.restart();
        }
      });
    }

    if(this.options.bullets){
      this.$bullets.on('click.zf.orbit touchend.zf.orbit', function(){
        if(/is-active/g.test(this.className)){ return false; }//if this is active, kick out of function.
        var idx = $(this).data('slide'),
            ltr = idx > _this.$slides.index($('.is-active')),
            $slide = _this.$slides.eq(idx);

        _this.changeSlide(ltr, $slide, idx);
      });
    }

    this.$wrapper.add(this.$bullets).on('keydown.zf.orbit', function(e){
      // handle keyboard event with keyboard util
      Foundation.handleKey(e, _this, {
        next: function() {
          _this.timer.restart();
          _this.changeSlide(true);
        },
        previous: function() {
          _this.timer.restart();
          _this.changeSlide(false);
        },
        handled: function() { // if bullet is focused, make sure focus moves
          if ($(e.target).is(_this.$bullets)) {
            _this.$bullets.filter('.is-active').focus();
          }
        }
      });
    });

  };
  Orbit.prototype.changeSlide = function(isLTR, chosenSlide, idx){
    var $curSlide = this.$slides.filter('.is-active').eq(0);


    if(/mui/g.test($curSlide[0].className)){ return false; }//if the slide is currently animating, kick out of the function

    var $firstSlide = this.$slides.first(),
        $lastSlide = this.$slides.last(),
        dirIn = isLTR ? 'Right' : 'Left',
        dirOut = isLTR ? 'Left' : 'Right',
        _this = this,
        $newSlide;

    if(!chosenSlide){//most of the time, this will be auto played or clicked from the navButtons.
      $newSlide = isLTR ? //if wrapping enabled, check to see if there is a `next` or `prev` sibling, if not, select the first or last slide to fill in. if wrapping not enabled, attempt to select `next` or `prev`, if there's nothing there, the function will kick out on next step. CRAZY NESTED TERNARIES!!!!!
                    (this.options.infiniteWrap ? $curSlide.next('.' + this.options.slideClass).length ? $curSlide.next('.' + this.options.slideClass) : $firstSlide : $curSlide.next('.' + this.options.slideClass))//pick next slide if moving left to right
                    :
                    (this.options.infiniteWrap ? $curSlide.prev('.' + this.options.slideClass).length ? $curSlide.prev('.' + this.options.slideClass) : $lastSlide : $curSlide.prev('.' + this.options.slideClass));//pick prev slide if moving right to left
    }else{
      $newSlide = chosenSlide;
    }
    if($newSlide.length){
      if(this.options.bullets){
        idx = idx || this.$slides.index($newSlide);//grab index to update bullets
        this._updateBullets(idx);
      }

      Foundation.Motion.animateIn(
        $newSlide.addClass('is-active').css({'position': 'absolute', 'top': 0}),
        this.options['animInFrom' + dirIn],
        function(){
          $newSlide.css({'position': 'relative', 'display': 'block'})
                   .attr('aria-live', 'polite');
        });

      Foundation.Motion.animateOut(
        $curSlide.removeClass('is-active'),
        this.options['animOutTo' + dirOut],
        function(){
          $curSlide.removeAttr('aria-live');
          //do stuff?
          _this.$element.trigger('slidechange.zf.orbit', [$newSlide]);
        });
    }
  };
  Orbit.prototype._updateBullets = function(idx){
    var $oldBullet = this.$element.find('.' + this.options.boxOfBullets)
                                  .find('.is-active').removeClass('is-active').blur(),
        span = $oldBullet.find('span:last').detach(),
        $newBullet = this.$bullets.eq(idx).addClass('is-active').append(span);
  };

  Orbit.prototype.destroy = function(){
    delete this.timer;
    this.$element.off('.zf.orbit').find('*').off('.zf.orbit').end().hide();
    this.$element.trigger('destroyed.zf.orbit');
  };

  Foundation.plugin(Orbit);

}(jQuery, window.Foundation);
