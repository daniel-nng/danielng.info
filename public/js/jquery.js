$( document ).ready(function() {
  ///for landing page
    $(".menulayout ").hover(function() { // Mouse over
        $(this).siblings().stop().fadeTo(300, 0.6);
        $(this).parent().siblings().stop().fadeTo(300, 0.3); 
      }, function() { // Mouse out
        $(this).siblings().stop().fadeTo(300, 1);
        $(this).parent().siblings().stop().fadeTo(300, 1);
      });
      //for overlay
      $(".overlay-content").hover(function() { // Mouse over
        $(this).siblings().stop().fadeTo(300, 0.6);
        $(this).parent().siblings().stop().fadeTo(300, 0.3); 
      }, function() { // Mouse out
        $(this).siblings().stop().fadeTo(300, 1);
        $(this).parent().siblings().stop().fadeTo(300, 1);
      });
});