import { GroupManager } from "./groupmanager-ffg.js";

/**
 * A specialized form used to pop out the editor.
 * @extends {FormApplication}
 *
 * OPTIONS:
 *
 *
 */
export default class DestinyTracker extends FormApplication {
  constructor() {
    super();

    this.destinyQueue = [];
    this.isRunningQueue = false;
  }

  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: "destiny-tracker",
      classes: ["starwarsffg"],
      title: "Destiny Tracker",
      template: "systems/starwarsffg/templates/ffg-destiny-tracker.html",
    });
  }

  /** @override */
  getData() {
    // Get current value
    let destinyPool = { light: game.settings.get("starwarsffg", "dPoolLight"), dark: game.settings.get("starwarsffg", "dPoolDark") };

    const x = $(window).width();
    const y = $(window).height();

    this.position.left = x - 505;
    this.position.top = y;
    this.position.width = 150;
    this.position.height = 105;

    // Return data
    return {
      destinyPool,
      isGM: game.user.isGM,
      menu: this.object.menu,
    };
  }

  /* -------------------------------------------- */

  /** @override */
  _updateObject(event, formData) {}

  /** @override */
  async close(options = {}) {}

  /** @override */
  activateListeners(html) {
    const topHeader = html.find(".swffg-destiny-bar")[0];
    new Draggable(this, html, topHeader, this.options.resizable);
    const bottomHeader = html.find(".swffg-destiny-bar")[1];
    new Draggable(this, html, bottomHeader, this.options.resizable);

    $("#destiny-tracker").css({ bottom: "0px", right: "305px" });

    // future functionality to allow multiple menu items to be passed in
    // html.find(".dropbtn").click((event) => {
    //   const id = `#${$(event.target).attr("id")}Content`;
    //   console.log("clicked");

    //   $(html.find(id)).toggleClass("show");
    // });
    // window.onclick = function(event) {
    //   if (!event.target.matches('.dropbtn')) {
    //     var dropdowns = document.getElementsByClassName("dropdown-content");
    //     var i;
    //     for (i = 0; i < dropdowns.length; i++) {
    //       var openDropdown = dropdowns[i];
    //       if (openDropdown.classList.contains('show')) {
    //         openDropdown.classList.remove('show');
    //       }
    //     }
    //   }
    // }
    // html.find(".dropdown-content a").click((event) => {
    //   event.preventDefault();
    //   event.stopPropagation();

    //   const index = event.currentTarget.dataset.value;
    //   this.object.menu[index].callback();
    //   $(event.currentTarget).parent().toggleClass("show");
    // })
    html.find(".group-manager").click((event) => {
      event.preventDefault();
      event.stopPropagation();
      new GroupManager().render(true);
    });

    html.find(".destiny-points").click(async (event) => {
      const pointType = event.currentTarget.dataset.group;
      var typeName = null;
      const add = event.shiftKey;
      const remove = event.ctrlKey;
      var flipType = null;
      var actionType = null;
      if (pointType == "dPoolLight") {
        flipType = "dPoolDark";
        typeName = "Light Side point";
      } else {
        flipType = "dPoolLight";
        typeName = "Dark Side point";
      }
      var messageText;

      if (!add && !remove) {
        if (game.settings.get("starwarsffg", pointType) == 0) {
          ui.notifications.warn(`Cannot flip a ${typeName} point; 0 remaining.`);
          return;
        } else {
          if (game.user.isGM) {
            game.settings.set("starwarsffg", flipType, game.settings.get("starwarsffg", flipType) + 1);
            game.settings.set("starwarsffg", pointType, game.settings.get("starwarsffg", pointType) - 1);
          } else {
            let pool = { light: 0, dark: 0 };
            if (flipType == "dPoolLight") {
              pool.light = game.settings.get("starwarsffg", flipType) + 1;
              pool.dark = game.settings.get("starwarsffg", pointType) - 1;
            } else if (flipType == "dPoolDark") {
              pool.dark = game.settings.get("starwarsffg", flipType) + 1;
              pool.light = game.settings.get("starwarsffg", pointType) - 1;
            }
            await game.socket.emit("system.starwarsffg", { pool });
          }
          messageText = `Flipped a ${typeName} point.`;
        }
      } else if (add) {
        if (!game.user.isGM) {
          ui.notifications.warn("Only GMs can add or remove points from the Destiny Pool.");
          return;
        }
        const setting = game.settings.settings.get(`starwarsffg.${pointType}`);
        game.settings.set("starwarsffg", pointType, game.settings.get("starwarsffg", pointType) + 1);
        messageText = "Added a " + typeName + " point.";
      } else if (remove) {
        if (!game.user.isGM) {
          ui.notifications.warn("Only GMs can add or remove points from the Destiny Pool.");
          return;
        }
        const setting = game.settings.settings.get(`starwarsffg.${pointType}`);
        game.settings.set("starwarsffg", pointType, game.settings.get("starwarsffg", pointType) - 1);
        messageText = "Removed a " + typeName + " point.";
      }

      ChatMessage.create({
        user: game.user._id,
        content: messageText,
      });
    });

    if (game.user.isGM) {
      new ContextMenu(html, ".swffg-destiny-bar", [
        {
          name: game.i18n.localize("SWFFG.RequestDestinyRoll"),
          icon: '<i class="fas fa-plus-circle"></i>',
          callback: (li) => {
            const messageText = `<button class="ffg-destiny-roll">${game.i18n.localize("SWFFG.DestinyPoolRoll")}</button>`;

            new Map([...game.settings.settings].filter(([k, v]) => v.key.includes("destinyrollers"))).forEach((i) => {
              game.settings.set(i.module, i.key, undefined);
            });

            ChatMessage.create({
              user: game.user._id,
              content: messageText,
            });
          },
        },
      ]);
    }

    // handle previously created roll destiny chat messages
    $(".ffg-destiny-roll").on("click", this.OnClickRollDestiny.bind(this));

    // setup chat hook for destiny roll
    Hooks.on("renderChatMessage", (app, html, messageData) => {
      html.on("click", ".ffg-destiny-roll", this.OnClickRollDestiny.bind(this));
    });

    // setup socket handler for checking destiny roll
    game.socket.on("system.starwarsffg", async (...args) => {
      if (args[0]?.canIRollDestinyResponse === game.user.id && !game.user.isGM) {
        if (!args[0]?.rolled) {
          const roll = this._rollDestiny();
          await game.socket.emit("system.starwarsffg", { destiny: game.user.id, light: roll.ffg.light, dark: roll.ffg.dark });
        } else {
          ui.notifications.error(`${game.i18n.localize("SWFFG.DestinyAlreadyRolled")}`);
        }
      }
    });

    if (game.user.isGM) {
      // socket handler for GM
      game.socket.on("system.starwarsffg", async (...args) => {
        // Can user roll destiny? Or have they already rolled
        if (args[0]?.canIRollDestiny) {
          let rolled = false;

          try {
            rolled = await game.settings.get("starwarsffg", `destinyrollers${args[0]?.canIRollDestiny}`);
          } catch (err) {
            game.settings.register("starwarsffg", `destinyrollers${args[0].canIRollDestiny}`, {
              name: "DestinyRoll",
              scope: "client",
              default: false,
              config: false,
              type: Boolean,
            });
          }

          await game.socket.emit("system.starwarsffg", { canIRollDestinyResponse: args[0]?.canIRollDestiny, rolled });
        }

        // Handle user initiated destiny pool flips
        if (args[0]?.pool) {
          const light = await game.settings.get("starwarsffg", "dPoolLight");
          const dark = await game.settings.get("starwarsffg", "dPoolDark");

          const request = {
            id: "player",
            type: "destiny-flip",
            light: +light - +args[0].pool.light,
            dark: +dark - +args[0].pool.dark,
          };

          this.destinyQueue.push(request);
        }

        // Handle user report for initial Destiny roll
        if (args[0]?.destiny) {
          const request = {
            id: args[0].destiny,
            type: "destiny-roll",
            light: args[0].light,
            dark: args[0].dark,
          };

          this.destinyQueue.push(request);
        }

        if (!this.isRunningQueue) {
          this._processDestinyRequests();
        }
      });
    }
  }

  // Click event for Roll Destiny Chat Message
  async OnClickRollDestiny(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!game.user.isGM) {
      await game.socket.emit("system.starwarsffg", { canIRollDestiny: game.user.id });
    }

    if (game.user.isGM) {
      const roll = this._rollDestiny();

      const light = await game.settings.get("starwarsffg", "dPoolLight");
      const dark = await game.settings.get("starwarsffg", "dPoolDark");

      await game.settings.set("starwarsffg", "dPoolLight", light + roll.ffg.light);
      await game.settings.set("starwarsffg", "dPoolDark", dark + roll.ffg.dark);
    }
  }

  async _processDestinyRequests() {
    CONFIG.logger.debug(`Processing ${this.destinyQueue.length} Destiny Requests`);

    while (this.destinyQueue.length > 0) {
      const request = this.destinyQueue.shift();
      CONFIG.logger.debug(`Processing Destiny Request (${request.type}) from User ${request.id}`, request);

      const light = await game.settings.get("starwarsffg", "dPoolLight");
      const dark = await game.settings.get("starwarsffg", "dPoolDark");

      switch (request.type) {
        case "destiny-roll": {
          game.settings.set("starwarsffg", `destinyrollers${request.id}`, true);
          await game.settings.set("starwarsffg", "dPoolLight", light + request.light);
          await game.settings.set("starwarsffg", "dPoolDark", dark + request.dark);
          break;
        }
        case "destiny-flip": {
          await game.settings.set("starwarsffg", "dPoolLight", light - request.light);
          game.settings.set("starwarsffg", "dPoolDark", dark - request.dark);
          break;
        }
      }
    }

    CONFIG.logger.debug(`Done Processing Destiny Requests`);
    this.isRunningQueue = false;
  }

  _rollDestiny() {
    const pool = new DicePoolFFG({
      force: 1,
    });

    const roll = new game.ffg.RollFFG(pool.renderDiceExpression());
    roll.toMessage({
      user: game.user._id,
      flavor: `${game.i18n.localize("SWFFG.Rolling")} ${game.i18n.localize("SWFFG.DestinyPool")}...`,
    });

    return roll;
  }
}
